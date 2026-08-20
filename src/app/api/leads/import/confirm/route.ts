import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { lerPlanilha, mapearLinhas, type CampoSistema } from "@/lib/importParser";
import { analisarLeadsImportados } from "@/lib/dedupe";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";

/**
 * Importação definitiva (seção 8, botão "CONFIRMAR IMPORTAÇÃO"):
 * cria apenas os leads válidos e não duplicados, registra o lote de importação
 * e grava auditoria de quem importou.
 */
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File | null;
  const mapeamentoRaw = formData.get("mapeamento") as string | null;
  const campanhaId = (formData.get("campanhaId") as string | null) || undefined;
  if (!arquivo || !mapeamentoRaw) return NextResponse.json({ erro: "Arquivo ou mapeamento ausente" }, { status: 400 });

  const mapeamento: Record<string, CampoSistema | null> = JSON.parse(mapeamentoRaw);
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const { linhas } = lerPlanilha(buffer, arquivo.name);
  const leadsImportados = mapearLinhas(linhas, mapeamento);

  const { linhas: linhasAnalisadas, resumo } = await analisarLeadsImportados(leadsImportados);
  const validos = linhasAnalisadas.filter((l) => l.situacao === "valido");

  const lote = await prisma.importacaoLote.create({
    data: {
      arquivoNome: arquivo.name,
      totalLinhas: resumo.totalLinhas,
      leadsValidos: resumo.leadsValidos,
      leadsInvalidos: resumo.leadsSemEmail + resumo.emailsInvalidos + resumo.telefonesInvalidos,
      duplicados: resumo.duplicados,
      jaExistentes: resumo.jaExistentes,
      mapeamento: mapeamento as any,
      importadoPorId: usuario.id
    }
  });

  const leadsCriados = await prisma.$transaction(
    validos.map((l) =>
      prisma.lead.create({
        data: {
          nome: l.nome || "Sem nome",
          email: l.email,
          telefone: l.telefone,
          empresa: l.empresa,
          documento: l.documento,
          observacao: l.observacao,
          responsavelId: usuario.id,
          campanhaId,
          origemImportacaoId: lote.id,
          proximoDisparo: campanhaId ? new Date() : undefined
        }
      })
    )
  );

  // Sem isso, o motor de automação (agendarFilaEnvio) nunca vê o lead — ele lê
  // a fila de trabalho a partir de LeadCampanhaProgresso, não direto de Lead.campanhaId.
  if (campanhaId) {
    await prisma.leadCampanhaProgresso.createMany({
      data: leadsCriados.map((lead) => ({ leadId: lead.id, campanhaId }))
    });
  }

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "IMPORTOU_LEADS",
    entidade: "ImportacaoLote",
    entidadeId: lote.id,
    detalhes: resumo
  });

  return NextResponse.json({ loteId: lote.id, importados: validos.length, resumo });
}
