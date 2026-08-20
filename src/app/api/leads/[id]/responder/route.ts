import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { enviarEmail } from "@/lib/email";
import { interromperSequenciaSeAtiva } from "@/lib/automacao";
import { z } from "zod";

const schema = z.object({
  assunto: z.string().optional(),
  corpo: z.string().min(1),
  cc: z.string().optional(),
  cco: z.string().optional(),
  anexos: z.array(z.object({ nome: z.string(), url: z.string().optional(), tipo: z.string().optional(), tamanho: z.number().optional() })).optional(),
  rascunho: z.boolean().default(false),
  encaminhadaDeId: z.string().optional()
});

/**
 * Responder / encaminhar / salvar rascunho, tudo dentro do próprio aplicativo
 * (seções 19 a 23). O responsável pela ação é sempre resolvido pela sessão
 * autenticada — nunca informado pelo frontend (seção 25).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpoReq = schema.parse(await req.json());
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: params.id }, include: { campanha: true } });
  if (!lead.email) return NextResponse.json({ erro: "Lead sem e-mail cadastrado" }, { status: 400 });

  if (corpoReq.rascunho) {
    const rascunho = await prisma.mensagem.create({
      data: {
        leadId: lead.id,
        direcao: "ENVIADA",
        assunto: corpoReq.assunto,
        corpo: corpoReq.corpo,
        para: lead.email,
        cc: corpoReq.cc,
        cco: corpoReq.cco,
        anexos: corpoReq.anexos,
        rascunho: true,
        pasta: "RASCUNHOS",
        status: "PENDENTE",
        usuarioId: usuario.id,
        encaminhadaDeId: corpoReq.encaminhadaDeId
      }
    });
    return NextResponse.json(rascunho, { status: 201 });
  }

  const mensagemId = randomUUID();
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const corpoComPixel = corpoReq.corpo + `<img src="${base}/api/mensagens/${mensagemId}/pixel" width="1" height="1" alt="" style="display:none" />`;

  const resultado = await enviarEmail({
    para: lead.email,
    cc: corpoReq.cc,
    assunto: corpoReq.assunto || "Re: contato",
    corpoHtml: corpoComPixel,
    contaEmailId: lead.campanha?.contaEmailId,
    anexos: corpoReq.anexos
  });

  const mensagem = await prisma.mensagem.create({
    data: {
      id: mensagemId,
      leadId: lead.id,
      direcao: "ENVIADA",
      assunto: corpoReq.assunto,
      corpo: corpoReq.corpo,
      para: lead.email,
      cc: corpoReq.cc,
      cco: corpoReq.cco,
      anexos: corpoReq.anexos,
      pasta: "ENVIADOS",
      status: resultado.sucesso ? "ENVIADO" : "FALHOU",
      usuarioId: usuario.id,
      gmailMessageId: resultado.gmailMessageId,
      encaminhadaDeId: corpoReq.encaminhadaDeId
    }
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: corpoReq.encaminhadaDeId ? "ENCAMINHOU_EMAIL" : "RESPONDEU_LEAD",
    entidade: "Lead",
    entidadeId: lead.id,
    detalhes: { mensagemId: mensagem.id, sucesso: resultado.sucesso }
  });

  // Responder manualmente também é uma forma de atendimento — se ainda havia
  // sequência de remarketing ativa para este lead, interrompe (regra fundamental, seção 15).
  await interromperSequenciaSeAtiva(lead.id);
  await prisma.lead.update({ where: { id: lead.id }, data: { status: "EM_ATENDIMENTO", responsavelId: lead.responsavelId ?? usuario.id } });

  return NextResponse.json(mensagem, { status: 201 });
}
