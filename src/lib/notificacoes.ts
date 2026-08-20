/**
 * Central de notificações (seções 16 e 49).
 * Cria notificações in-app para o responsável pelo lead (ou para todos os
 * administradores quando não houver responsável definido).
 */
import { prisma } from "./prisma";
import type { TipoNotificacao } from "@prisma/client";

export async function notificar(params: {
  destinatarioId: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  leadId?: string;
}) {
  return prisma.notificacao.create({
    data: {
      destinatarioId: params.destinatarioId,
      tipo: params.tipo,
      titulo: params.titulo,
      mensagem: params.mensagem,
      leadId: params.leadId
    }
  });
}

/** Notifica o responsável do lead; se não houver, notifica todos os administradores. */
export async function notificarSobreLead(params: {
  leadId: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
}) {
  const lead = await prisma.lead.findUnique({ where: { id: params.leadId }, select: { responsavelId: true } });

  if (lead?.responsavelId) {
    await notificar({ destinatarioId: lead.responsavelId, tipo: params.tipo, titulo: params.titulo, mensagem: params.mensagem, leadId: params.leadId });
    return;
  }

  const admins = await prisma.usuario.findMany({ where: { perfil: "ADMINISTRADOR", status: "ATIVO" }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      notificar({ destinatarioId: admin.id, tipo: params.tipo, titulo: params.titulo, mensagem: params.mensagem, leadId: params.leadId })
    )
  );
}
