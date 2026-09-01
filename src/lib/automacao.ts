/**
 * Motor de automação de remarketing, em duas fases (seção 47/48):
 *
 *  1) `agendarFilaEnvio()` — para cada lead ativo cuja próxima etapa está no
 *     horário, roda o checklist completo (seção 46) e cria um item na fila
 *     (`FilaEnvio`) com uma chave de idempotência única. Nunca cria dois itens
 *     para o mesmo lead+campanha+etapa.
 *  2) `processarFilaEnvio()` — processa os itens pendentes da fila, respeitando
 *     os limites de disparo da conta de e-mail (por hora/dia/horário/dias da
 *     semana) e fazendo retentativa controlada com backoff em caso de erro
 *     temporário, até um limite de tentativas.
 *
 * `executarCicloRemarketing()` roda as duas fases em sequência e é a função
 * chamada por POST /api/automacoes/run (cron externo ou botão "Rodar agora").
 */
import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { personalizarTexto } from "./personalizacao";
import { enviarEmail } from "./email";
import { adicionarAnotacaoChatGuru } from "./chatguru";
import { marcarEnviadoNaPlanilha, importarLeadsDaPlanilha } from "./googleSheets";
import { registrarAuditoria } from "./audit";
import { notificarSobreLead } from "./notificacoes";
import type { ContaEmail } from "@prisma/client";

const STATUS_QUE_INTERROMPEM = ["RESPONDEU", "EM_ATENDIMENTO", "CONVERTIDO", "NAO_INTERESSADO", "ENCERRADO", "BLOQUEADO", "OPT_OUT"];
const MAX_TENTATIVAS = 5;
const BACKOFF_BASE_MINUTOS = 15;

/** Horário local (Brasília) legível para anotações — não depende de process.env.TZ, que a Vercel não permite definir. */
function agoraBrasiliaLegivel() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export async function interromperSequencia(leadId: string, campanhaId: string, motivo: string, novoStatus: "RESPONDEU" | "OPT_OUT" = "RESPONDEU") {
  await prisma.leadCampanhaProgresso.updateMany({
    where: { leadId, campanhaId },
    data: { interrompida: true, motivoParada: motivo }
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: novoStatus === "RESPONDEU" ? { status: novoStatus, ultimaResposta: new Date() } : { status: novoStatus, optOut: true, optOutEm: new Date() }
  });
}

function linkOptOut(leadId: string) {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base}/api/optout?lead=${leadId}`;
}

/** Pixel de rastreamento de abertura (✓✓ estilo WhatsApp) — não é garantia, o cliente de e-mail do lead pode bloquear imagens remotas. */
function pixelVisualizacao(mensagemId: string) {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `<img src="${base}/api/mensagens/${mensagemId}/pixel" width="1" height="1" alt="" style="display:none" />`;
}

/**
 * Checklist obrigatório antes de QUALQUER disparo automático (seção 46):
 * respondeu / opt-out / convertido / campanha ativa / e-mail válido / lead bloqueado.
 */
function podeEnviar(progresso: {
  lead: { status: string; optOut: boolean; bloqueado: boolean; email: string | null };
  campanha: { status: string };
}) {
  if (STATUS_QUE_INTERROMPEM.includes(progresso.lead.status)) return { ok: false, motivo: `Status do lead impede envio: ${progresso.lead.status}` };
  if (progresso.lead.optOut) return { ok: false, motivo: "Lead solicitou opt-out" };
  if (progresso.lead.bloqueado) return { ok: false, motivo: "Lead está bloqueado" };
  if (progresso.campanha.status !== "ATIVA") return { ok: false, motivo: "Campanha não está ativa" };
  if (!progresso.lead.email) return { ok: false, motivo: "Lead sem e-mail válido" };
  return { ok: true as const };
}

/** Seção 30 — respeita horário e dias da semana permitidos para a conta de envio. */
function dentroDaJanelaPermitida(conta: ContaEmail | null | undefined, agora: Date) {
  if (!conta) return true; // modo legado (conta única via .env) não tem limites configurados
  if (!conta.diasSemanaPermitidos.includes(agora.getDay())) return false;
  const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  return hhmm >= conta.horarioInicioPermitido && hhmm <= conta.horarioFimPermitido;
}

/** Seção 30 — respeita a quantidade máxima de disparos por hora/dia da conta de envio. */
async function dentroDosLimites(conta: ContaEmail, agora: Date) {
  const inicioHora = new Date(agora);
  inicioHora.setMinutes(0, 0, 0);
  const inicioDia = new Date(agora);
  inicioDia.setHours(0, 0, 0, 0);

  const [naHora, noDia] = await Promise.all([
    prisma.mensagem.count({ where: { contaEmailId: conta.id, direcao: "ENVIADA", criadoEm: { gte: inicioHora } } }),
    prisma.mensagem.count({ where: { contaEmailId: conta.id, direcao: "ENVIADA", criadoEm: { gte: inicioDia } } })
  ]);

  return naHora < conta.limitePorHora && noDia < conta.limitePorDia;
}

/** Fase 1: agenda os próximos envios devidos na fila, sem enviar nada ainda. */
export async function agendarFilaEnvio() {
  const agora = new Date();
  const progressos = await prisma.leadCampanhaProgresso.findMany({
    where: { interrompida: false },
    include: {
      lead: true,
      campanha: { include: { etapas: { orderBy: { ordem: "asc" } } } }
    }
  });

  let agendados = 0;
  let encerrados = 0;

  for (const progresso of progressos) {
    if (progresso.lead.proximoDisparo && progresso.lead.proximoDisparo > agora) continue;

    const proximaEtapa = progresso.campanha.etapas.find((e) => e.ordem === progresso.etapaAtual);
    if (!proximaEtapa) {
      if (progresso.lead.status !== "ENCERRADO" && progresso.lead.status !== "CONVERTIDO") {
        await prisma.lead.update({ where: { id: progresso.leadId }, data: { status: "ENCERRADO" } });
        encerrados++;
      }
      continue;
    }

    if (!podeEnviar(progresso).ok) continue;

    const chaveIdempotencia = `${progresso.leadId}:${progresso.campanhaId}:${proximaEtapa.ordem}`;
    const existente = await prisma.filaEnvio.findUnique({ where: { chaveIdempotencia } });
    if (existente) continue;

    try {
      await prisma.filaEnvio.create({
        data: {
          chaveIdempotencia,
          leadId: progresso.leadId,
          campanhaId: progresso.campanhaId,
          etapaOrdem: proximaEtapa.ordem,
          horarioProgramado: progresso.lead.proximoDisparo ?? agora
        }
      });
      agendados++;
    } catch (erro: any) {
      // Duas execuções do ciclo (ex: cron de 1 em 1 minuto sobrepondo) podem tentar
      // agendar o mesmo item ao mesmo tempo — a chave de idempotência é quem
      // garante que só um vence; a outra só encontra a corrida, não é uma falha real.
      if (erro?.code !== "P2002") throw erro;
    }
  }

  return { agendados, encerrados };
}

/** Fase 2: processa a fila, respeitando limites da conta e retentativa controlada. */
export async function processarFilaEnvio() {
  const agora = new Date();
  const itens = await prisma.filaEnvio.findMany({
    where: { status: "PENDENTE", horarioProgramado: { lte: agora } },
    orderBy: { horarioProgramado: "asc" },
    take: 100,
    include: {
      lead: true,
      campanha: { include: { etapas: { orderBy: { ordem: "asc" }, include: { modelo: true } }, contaEmail: true } }
    }
  });

  let enviados = 0;
  let falhas = 0;
  let canceladas = 0;
  let adiadas = 0;

  // Espaça os envios de uma mesma conta (seção 30, intervaloSegundosEntreEnvios) — enviar
  // em rajada de uma conta pessoal do Gmail é um forte sinal de spam para o provedor.
  const ultimoEnvioPorConta = new Map<string, number>();

  for (const item of itens) {
    const etapa = item.campanha.etapas.find((e) => e.ordem === item.etapaOrdem);
    if (!etapa) {
      await prisma.filaEnvio.update({ where: { id: item.id }, data: { status: "CANCELADO", ultimoErro: "Etapa não existe mais na campanha" } });
      canceladas++;
      continue;
    }

    const checklist = podeEnviar({ lead: item.lead, campanha: item.campanha });
    if (!checklist.ok) {
      await prisma.filaEnvio.update({ where: { id: item.id }, data: { status: "CANCELADO", ultimoErro: checklist.motivo } });
      canceladas++;
      continue;
    }

    const conta = item.campanha.contaEmail;
    if (conta && !dentroDaJanelaPermitida(conta, agora)) {
      adiadas++;
      continue; // fora do horário/dia permitido — tenta de novo na próxima execução, sem penalizar tentativas
    }
    if (conta && !(await dentroDosLimites(conta, agora))) {
      adiadas++;
      continue; // limite por hora/dia atingido — tenta de novo depois
    }

    if (conta) {
      const ultimoEnvio = ultimoEnvioPorConta.get(conta.id);
      const intervaloMs = conta.intervaloSegundosEntreEnvios * 1000;
      if (ultimoEnvio) {
        const faltam = intervaloMs - (Date.now() - ultimoEnvio);
        if (faltam > 0) await new Promise((resolve) => setTimeout(resolve, faltam));
      }
    }

    await prisma.filaEnvio.update({ where: { id: item.id }, data: { status: "PROCESSANDO" } });

    const dadosPersonalizacao = {
      nome: item.lead.nome,
      empresa: item.lead.empresa,
      email: item.lead.email,
      telefone: item.lead.telefone,
      responsavel: undefined as string | undefined
    };
    if (item.lead.responsavelId) {
      const responsavel = await prisma.usuario.findUnique({ where: { id: item.lead.responsavelId } });
      dadosPersonalizacao.responsavel = responsavel?.nome;
    }

    const mensagemId = randomUUID();
    const assunto = personalizarTexto(etapa.modelo.assunto, dadosPersonalizacao);
    const rodapeOptOut = `<p style="font-size:12px;color:#888;margin-top:24px;">Caso não queira mais receber nossos contatos, <a href="${linkOptOut(item.leadId)}">clique aqui para não receber novas mensagens</a>.</p>`;
    const corpo = personalizarTexto(etapa.modelo.corpoHtml, dadosPersonalizacao) + rodapeOptOut + pixelVisualizacao(mensagemId);

    const resultado = await enviarEmail({
      para: item.lead.email!,
      assunto,
      corpoHtml: corpo,
      contaEmailId: item.campanha.contaEmailId,
      anexos: etapa.modelo.anexos as any
    });
    if (conta) ultimoEnvioPorConta.set(conta.id, Date.now());

    if (resultado.sucesso) {
      await prisma.mensagem.create({
        data: {
          id: mensagemId,
          leadId: item.leadId,
          anexos: etapa.modelo.anexos ?? undefined,
          direcao: "ENVIADA",
          assunto,
          corpo,
          para: item.lead.email,
          status: "ENVIADO",
          campanhaEtapaOrdem: etapa.ordem,
          contaEmailId: item.campanha.contaEmailId,
          gmailMessageId: resultado.gmailMessageId,
          chaveIdempotencia: item.chaveIdempotencia,
          pasta: "ENVIADOS"
        }
      });

      await prisma.filaEnvio.update({ where: { id: item.id }, data: { status: "ENVIADO", processadoEm: new Date() } });

      const proximoDisparo = new Date();
      proximoDisparo.setDate(proximoDisparo.getDate() + (etapa.diasAposAnterior || item.campanha.intervaloDias));

      const progresso = await prisma.leadCampanhaProgresso.findUnique({ where: { leadId_campanhaId: { leadId: item.leadId, campanhaId: item.campanhaId } } });
      if (progresso) {
        await prisma.leadCampanhaProgresso.update({ where: { id: progresso.id }, data: { etapaAtual: etapa.ordem + 1 } });
      }
      await prisma.lead.update({
        where: { id: item.leadId },
        data: {
          status: etapa.ordem === 0 ? "EMAIL_ENVIADO" : "EM_REMARKETING",
          etapaAtual: etapa.ordem + 1,
          ultimoContato: new Date(),
          proximoDisparo
        }
      });

      if (item.lead.chatguruContatoId || item.lead.telefone) {
        await adicionarAnotacaoChatGuru(
          item.leadId,
          `📧 E-MAIL MARKETING\nCampanha: ${item.campanha.nome}\nEtapa: E-mail ${etapa.ordem + 1}\nEnviado em: ${agoraBrasiliaLegivel()}`
        ).catch(() => null);
      }

      // Marca "enviado" na coluna de status da planilha de origem (se configurado) —
      // não deve impedir o envio já concluído, então erros aqui só ficam registrados.
      await marcarEnviadoNaPlanilha(item.lead.email).catch((erro) => {
        console.error(`[googleSheets] Falha ao marcar lead ${item.leadId} como enviado na planilha:`, erro?.message ?? erro);
      });

      enviados++;
    } else {
      const tentativas = item.tentativas + 1;

      if (tentativas >= MAX_TENTATIVAS) {
        await prisma.filaEnvio.update({ where: { id: item.id }, data: { status: "FALHOU", tentativas, ultimoErro: resultado.erro } });
        await prisma.mensagem.create({
          data: {
            leadId: item.leadId,
            direcao: "ENVIADA",
            assunto,
            corpo,
            para: item.lead.email,
            status: "FALHOU",
            campanhaEtapaOrdem: etapa.ordem,
            contaEmailId: item.campanha.contaEmailId,
            chaveIdempotencia: item.chaveIdempotencia,
            pasta: "ENVIADOS"
          }
        });
        await notificarSobreLead({
          leadId: item.leadId,
          tipo: "ERRO_ENVIO",
          titulo: "Falha ao enviar e-mail após várias tentativas",
          mensagem: `Falha ao enviar e-mail da campanha "${item.campanha.nome}" para ${item.lead.nome} após ${tentativas} tentativas: ${resultado.erro}`
        });
        falhas++;
      } else {
        const backoffMin = BACKOFF_BASE_MINUTOS * Math.pow(2, tentativas - 1);
        const proximaTentativa = new Date();
        proximaTentativa.setMinutes(proximaTentativa.getMinutes() + backoffMin);
        await prisma.filaEnvio.update({
          where: { id: item.id },
          data: { status: "PENDENTE", tentativas, ultimoErro: resultado.erro, horarioProgramado: proximaTentativa }
        });
        adiadas++;
      }
    }
  }

  return { enviados, falhas, canceladas, adiadas, avaliados: itens.length };
}

export async function executarCicloRemarketing() {
  // Varre a planilha de leads (se configurada) antes de agendar — assim um lead
  // novo na planilha pode ser importado e enviado no mesmo ciclo.
  const importacaoPlanilha = await importarLeadsDaPlanilha().catch((erro) => {
    console.error("[googleSheets] Falha ao importar leads da planilha:", erro?.message ?? erro);
    return { novosLeads: 0, avaliados: 0, erro: String(erro?.message ?? erro) };
  });

  const { agendados, encerrados } = await agendarFilaEnvio();
  const resultado = await processarFilaEnvio();

  await registrarAuditoria({
    acao: "EXECUTOU_CICLO_REMARKETING",
    detalhes: { importacaoPlanilha, agendados, encerrados, ...resultado }
  });

  return { importacaoPlanilha, agendados, encerrados, ...resultado };
}

/**
 * Interrompe a sequência de remarketing sem gerar a notificação de "nova resposta"
 * (usado quando é o próprio operador que está respondendo manualmente pelo app —
 * diferente de uma resposta do lead detectada automaticamente via sync/webhook).
 */
export async function interromperSequenciaSeAtiva(leadId: string) {
  const progresso = await prisma.leadCampanhaProgresso.findFirst({ where: { leadId, interrompida: false } });
  if (progresso) {
    await prisma.leadCampanhaProgresso.update({
      where: { id: progresso.id },
      data: { interrompida: true, motivoParada: "Atendimento manual iniciado pelo operador." }
    });
  }
}

/**
 * Avisa o cenário do Make (anotação no ChatGuru + cópia por e-mail ao responsável +
 * aviso no WhatsApp interno) de que um lead respondeu. Best-effort: nunca lança —
 * uma falha aqui não pode impeder o resto do tratamento da resposta.
 */
async function notificarMakeRespostaLead(leadId: string, campanhaNome: string | null) {
  const url = process.env.MAKE_WEBHOOK_RESPOSTA_LEAD_URL;
  if (!url) return;

  try {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    const [ultimaMensagem, responsavel] = await Promise.all([
      prisma.mensagem.findFirst({ where: { leadId, direcao: "RECEBIDA" }, orderBy: { criadoEm: "desc" } }),
      lead.responsavelId ? prisma.usuario.findUnique({ where: { id: lead.responsavelId } }) : null
    ]);

    const resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadNome: lead.nome,
        leadEmail: lead.email,
        leadTelefone: lead.telefone,
        campanhaNome: campanhaNome ?? "",
        responsavelNome: responsavel?.nome ?? "",
        responsavelEmail: responsavel?.email ?? "",
        textoResposta: ultimaMensagem?.corpo ?? ""
      })
    });
    console.log(`[make] Webhook de resposta do lead ${leadId} chamado, status ${resposta.status}`);
  } catch (erro) {
    console.error("[make] Falha ao notificar webhook de resposta do lead:", erro);
  }
}

/** Chamado quando uma resposta do lead é detectada (via Gmail ou webhook do ChatGuru) — seções 15 e 39. */
export async function tratarRespostaDetectada(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const progresso = await prisma.leadCampanhaProgresso.findFirst({ where: { leadId, interrompida: false }, include: { campanha: true } });

  if (progresso) {
    await interromperSequencia(leadId, progresso.campanhaId, "Lead respondeu ao e-mail.");
    await adicionarAnotacaoChatGuru(
      leadId,
      `📩 CLIENTE RESPONDEU POR E-MAIL\nCampanha: ${progresso.campanha.nome}\nData: ${agoraBrasiliaLegivel()}`
    ).catch(() => null);
    await notificarSobreLead({
      leadId,
      tipo: "NOVA_RESPOSTA",
      titulo: "Nova resposta",
      mensagem: `${lead.nome} respondeu ao e-mail da campanha "${progresso.campanha.nome}".`
    });
    await notificarMakeRespostaLead(leadId, progresso.campanha.nome).catch(() => null);
  } else {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "RESPONDEU", ultimaResposta: new Date() } });
    await notificarSobreLead({ leadId, tipo: "NOVA_RESPOSTA", titulo: "Nova resposta", mensagem: `${lead.nome} respondeu por e-mail.` });
    await notificarMakeRespostaLead(leadId, null).catch(() => null);
  }
}

/** Opt-out manual ou via link no rodapé do e-mail (seção 31). */
export async function registrarOptOut(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const progresso = await prisma.leadCampanhaProgresso.findFirst({ where: { leadId, interrompida: false } });
  if (progresso) {
    await interromperSequencia(leadId, progresso.campanhaId, "Lead solicitou opt-out.", "OPT_OUT");
  } else {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "OPT_OUT", optOut: true, optOutEm: new Date() } });
  }
  if (lead.email) {
    await prisma.listaSupressao.upsert({ where: { email: lead.email }, update: {}, create: { email: lead.email, motivo: "Opt-out via e-mail" } });
  }
}
