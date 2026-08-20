import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { notificar } from "@/lib/notificacoes";

/** Transferência de lead entre responsáveis (seção 57), com auditoria e notificação. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { novoResponsavelId } = await req.json();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: params.id } });
  const responsavelAnteriorId = lead.responsavelId;

  await prisma.lead.update({ where: { id: params.id }, data: { responsavelId: novoResponsavelId } });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "TRANSFERIU_LEAD",
    entidade: "Lead",
    entidadeId: lead.id,
    detalhes: { de: responsavelAnteriorId, para: novoResponsavelId }
  });

  await notificar({
    destinatarioId: novoResponsavelId,
    tipo: "NOVO_ATENDIMENTO",
    titulo: "Lead transferido para você",
    mensagem: `${usuario.name} transferiu ${lead.nome} para você.`,
    leadId: lead.id
  });

  return NextResponse.json({ ok: true });
}
