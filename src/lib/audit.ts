import { prisma } from "./prisma";

/**
 * Registra uma ação no log de auditoria.
 * Chamar sempre que um usuário realizar uma ação relevante
 * (importar leads, criar campanha, responder lead, alterar usuário, etc.)
 */
export async function registrarAuditoria(params: {
  usuarioId?: string | null;
  acao: string;
  entidade?: string;
  entidadeId?: string;
  detalhes?: unknown;
}) {
  return prisma.logAuditoria.create({
    data: {
      usuarioId: params.usuarioId ?? null,
      acao: params.acao,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      detalhes: params.detalhes ? JSON.parse(JSON.stringify(params.detalhes)) : undefined
    }
  });
}
