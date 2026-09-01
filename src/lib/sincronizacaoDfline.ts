/**
 * Sincronização "planilha funil 2.1" → DFLINE.
 *
 * Não lemos a planilha diretamente: o cenário Make.com "1 - Cadastro ChatGuru" já
 * observa as abas (consolidado 2.1.5 / PRODUTOR RURAL), já decide o que é "lead
 * novo" e já registra no ChatGuru — este módulo só é chamado por ELE (via
 * POST /api/dfline-sync/webhook) depois que o registro no ChatGuru foi concluído,
 * e cuida da parte de criar o card correspondente no DFLINE.
 */
import { prisma } from "./prisma";
import { registrarAuditoria } from "./audit";
import { adicionarAnotacaoChatGuruPorTelefone } from "./chatguru";
import { buscarDealPorTelefone, buscarEquipesEUsuarios, criarDealNoDfline } from "./dflineFirestore";
import type { OrigemLeadDfline } from "@prisma/client";

export type PayloadSincronizacaoDfline = {
  origemAba: OrigemLeadDfline;
  contato: string;
  empresa?: string;
  telefone: string;
  email?: string;
  equipe?: string;
  responsavel?: string;
  cnpj?: string;
  faixaDivida?: string;
  situacaoDivida?: string;
  meiosContato?: string;
  campanhaCriativo?: string;
  dataEntrada?: string;
  observacao?: string;
};

export function normalizarTelefone(telefone: string) {
  return (telefone || "").replace(/\D/g, "");
}

function normalizarTexto(valor: string) {
  return (valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Remove prefixos de rodízio do Make, ex: "1 - Arthur" / "3.1 - João" → "Arthur" / "João". */
function limparPrefixoRodizio(texto: string) {
  return (texto || "").replace(/^[\d.]+\s*-\s*/, "").trim();
}

function mapearEquipe(textoPlanilha: string | undefined, equipesReais: string[]) {
  if (!textoPlanilha) return undefined;
  const alvo = normalizarTexto(textoPlanilha);
  return equipesReais.find((e) => normalizarTexto(e) === alvo) ?? textoPlanilha;
}

function mapearResponsavel(
  textoPlanilha: string | undefined,
  usuarios: Array<{ id: number; name: string; role: string }>
) {
  if (!textoPlanilha) return { sdrId: undefined, nomeEncontrado: undefined };
  const nomeLimpo = limparPrefixoRodizio(textoPlanilha);
  const alvo = normalizarTexto(nomeLimpo);
  const encontrado = usuarios.find((u) => normalizarTexto(u.name) === alvo || alvo.includes(normalizarTexto(u.name)));
  return { sdrId: encontrado?.id, nomeEncontrado: encontrado?.name };
}

function montarObservacaoInicial(payload: PayloadSincronizacaoDfline) {
  const linhas = [
    "Card criado automaticamente pela sincronização Funil 2.1 → DFLINE.",
    payload.email ? `E-mail: ${payload.email}` : null,
    payload.cnpj ? `CNPJ: ${payload.cnpj}` : null,
    payload.faixaDivida ? `Faixa da dívida: ${payload.faixaDivida}` : null,
    payload.situacaoDivida ? `Situação da dívida: ${payload.situacaoDivida}` : null,
    payload.meiosContato ? `Meios de contato: ${payload.meiosContato}` : null,
    payload.campanhaCriativo ? `Campanha/criativo: ${payload.campanhaCriativo}` : null,
    payload.dataEntrada ? `Data de entrada na planilha: ${payload.dataEntrada}` : null,
    payload.observacao ? `Observação: ${payload.observacao}` : null
  ].filter(Boolean);
  return linhas.join("\n");
}

export async function sincronizarLeadDfline(payload: PayloadSincronizacaoDfline) {
  const telefoneNormalizado = normalizarTelefone(payload.telefone);
  if (!telefoneNormalizado) {
    throw new Error("Lead sem telefone válido — não é possível sincronizar com o DFLINE.");
  }

  const jaImportado = await prisma.leadDflineImportado.findUnique({ where: { telefoneNormalizado } });
  if (jaImportado) {
    return { duplicado: true, dealId: jaImportado.dflineDealId };
  }

  // Segunda checagem, best-effort, contra deals já existentes no DFLINE criados por
  // outra via (import de Meta Lead Ads, cadastro manual etc.) — ver ressalva em
  // dflineFirestore.buscarDealPorTelefone.
  const dealExistente = await buscarDealPorTelefone(telefoneNormalizado).catch(() => null);
  if (dealExistente) {
    await prisma.leadDflineImportado.create({
      data: {
        origemAba: payload.origemAba,
        telefoneNormalizado,
        dflineDealId: dealExistente.id,
        nome: payload.contato,
        empresa: payload.empresa,
        equipe: payload.equipe,
        responsavelTexto: payload.responsavel
      }
    });
    return { duplicado: true, dealId: dealExistente.id };
  }

  const { equipes, usuarios } = await buscarEquipesEUsuarios();
  const equipeMapeada = mapearEquipe(payload.equipe, equipes);
  const { sdrId, nomeEncontrado } = mapearResponsavel(payload.responsavel, usuarios);

  const { dealId } = await criarDealNoDfline({
    contato: payload.contato,
    empresa: payload.empresa,
    telefone: payload.telefone,
    email: payload.email,
    equipe: equipeMapeada,
    sdrId,
    campanha: payload.campanhaCriativo,
    observacaoInicial: montarObservacaoInicial(payload)
  });

  await prisma.leadDflineImportado.create({
    data: {
      origemAba: payload.origemAba,
      telefoneNormalizado,
      dflineDealId: dealId,
      nome: payload.contato,
      empresa: payload.empresa,
      equipe: equipeMapeada,
      responsavelTexto: payload.responsavel,
      sdrIdDfline: sdrId !== undefined ? BigInt(sdrId) : undefined
    }
  });

  await adicionarAnotacaoChatGuruPorTelefone(
    payload.telefone,
    "CADASTRO NO CRM EFETIVADO - CONFIRA NA ABA OPORTUNIDADE NOVO LEAD"
  ).catch(() => null); // best-effort: não derruba a sincronização se o ChatGuru falhar aqui

  await registrarAuditoria({
    acao: "SINCRONIZOU_LEAD_DFLINE",
    entidade: "LeadDflineImportado",
    entidadeId: dealId,
    detalhes: { origemAba: payload.origemAba, telefone: payload.telefone, equipe: equipeMapeada, responsavel: nomeEncontrado, sdrIdSemMatch: !!payload.responsavel && !sdrId }
  });

  return { duplicado: false, dealId, sdrEncontrado: !!sdrId };
}
