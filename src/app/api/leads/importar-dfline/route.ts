import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { analisarLeadsImportados } from "@/lib/dedupe";
import { registrarAuditoria } from "@/lib/audit";

/**
 * Chamado diretamente do navegador pelo botão "✉️ Enviar para E-mail Marketing"
 * no card do DFLINE (seção 36 do roteiro: quando o SDR move o lead para a Base de
 * Remarketing, ele não deve precisar copiar telefone/e-mail nem recadastrar nada).
 *
 * Como o DFLINE é um app estático sem backend próprio, essa chamada é feita
 * cross-origin direto do navegador do SDR — por isso libera CORS e usa um segredo
 * simples (DFLINE_LEAD_IMPORT_SECRET) em vez de sessão. Esse segredo fica visível
 * no código-fonte do DFLINE (não tem como evitar sem um backend lá), no mesmo nível
 * de exposição que a chave do ChatGuru que o próprio DFLINE já embute hoje — serve
 * só para barrar chamadas aleatórias, não é uma garantia forte de autenticação.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const payloadSchema = z
  .object({
    nome: z.string().min(1),
    telefone: z.string().optional(),
    email: z.string().optional(),
    empresa: z.string().optional(),
    dflineDealId: z.string().optional(),
    observacao: z.string().optional()
  })
  .refine((d) => !!d.telefone || !!d.email, { message: "Informe telefone ou e-mail." });

export async function POST(req: NextRequest) {
  const segredo = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.DFLINE_LEAD_IMPORT_SECRET || segredo !== process.env.DFLINE_LEAD_IMPORT_SECRET) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401, headers: CORS_HEADERS });
  }

  const corpo = await req.json().catch(() => null);
  const analisado = payloadSchema.safeParse(corpo);
  if (!analisado.success) {
    return NextResponse.json({ erro: "Payload inválido", detalhes: analisado.error.flatten() }, { status: 400, headers: CORS_HEADERS });
  }
  const dados = analisado.data;
  const campanhaId = process.env.DFLINE_REMARKETING_CAMPANHA_ID || undefined;

  const { linhas } = await analisarLeadsImportados([
    {
      nome: dados.nome,
      email: dados.email || null,
      telefone: dados.telefone || null,
      empresa: dados.empresa || null,
      documento: null,
      observacao: null
    }
  ]);
  const resultado = linhas[0];

  const observacaoCompleta = [
    dados.dflineDealId ? `Importado do DFLINE (card ${dados.dflineDealId}).` : "Importado do DFLINE.",
    dados.observacao
  ]
    .filter(Boolean)
    .join(" ");

  // Lead já existe neste app — só garante que entrou (ou já está) na campanha de
  // remarketing, sem duplicar o cadastro.
  if (resultado.situacao === "ja_existente" && resultado.leadExistenteId) {
    if (campanhaId) {
      const jaTemProgresso = await prisma.leadCampanhaProgresso.findUnique({
        where: { leadId_campanhaId: { leadId: resultado.leadExistenteId, campanhaId } }
      });
      if (!jaTemProgresso) {
        await prisma.leadCampanhaProgresso.create({ data: { leadId: resultado.leadExistenteId, campanhaId } });
        await prisma.lead.update({
          where: { id: resultado.leadExistenteId },
          data: { campanhaId, status: "EM_REMARKETING", proximoDisparo: new Date() }
        });
      }
    }
    await registrarAuditoria({
      acao: "ENVIOU_LEAD_DFLINE_PARA_REMARKETING",
      entidade: "Lead",
      entidadeId: resultado.leadExistenteId,
      detalhes: { dflineDealId: dados.dflineDealId, jaExistia: true }
    });
    return NextResponse.json({ ok: true, leadId: resultado.leadExistenteId, jaExistia: true }, { headers: CORS_HEADERS });
  }

  if (resultado.situacao !== "valido") {
    return NextResponse.json({ erro: `Não foi possível importar (${resultado.situacao}).` }, { status: 400, headers: CORS_HEADERS });
  }

  const lead = await prisma.lead.create({
    data: {
      nome: dados.nome,
      email: dados.email || null,
      telefone: dados.telefone || null,
      empresa: dados.empresa || null,
      observacao: observacaoCompleta,
      status: "EM_REMARKETING",
      campanhaId,
      proximoDisparo: campanhaId ? new Date() : undefined
    }
  });

  if (campanhaId) {
    await prisma.leadCampanhaProgresso.create({ data: { leadId: lead.id, campanhaId } });
  }

  await registrarAuditoria({
    acao: "ENVIOU_LEAD_DFLINE_PARA_REMARKETING",
    entidade: "Lead",
    entidadeId: lead.id,
    detalhes: { dflineDealId: dados.dflineDealId, jaExistia: false }
  });

  return NextResponse.json({ ok: true, leadId: lead.id, jaExistia: false }, { headers: CORS_HEADERS });
}
