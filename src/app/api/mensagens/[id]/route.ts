import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  assunto: z.string().optional(),
  corpo: z.string().min(1)
});

/**
 * Corrige apenas o registro salvo no sistema (histórico interno) — não altera
 * o e-mail já entregue na caixa do lead, o que não é tecnicamente possível.
 * Marca `editadoEm` para deixar claro na interface que o texto foi corrigido.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const dados = schema.parse(await req.json());
  const existente = await prisma.mensagem.findUnique({ where: { id: params.id } });
  if (!existente) return NextResponse.json({ erro: "Mensagem não encontrada" }, { status: 404 });

  const mensagem = await prisma.mensagem.update({
    where: { id: params.id },
    data: { assunto: dados.assunto, corpo: dados.corpo, editadoEm: new Date() }
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "CORRIGIU_REGISTRO_MENSAGEM",
    entidade: "Mensagem",
    entidadeId: mensagem.id,
    detalhes: { leadId: mensagem.leadId }
  });

  return NextResponse.json(mensagem);
}
