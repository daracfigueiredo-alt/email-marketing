import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/** Lista as contas de e-mail conectadas e ativas — usado no seletor "Enviar como" das campanhas. */
export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const contas = await prisma.contaEmail.findMany({
    where: { ativa: true },
    select: { id: true, emailConta: true, nomeRemetente: true, provedor: true },
    orderBy: { criadoEm: "desc" }
  });
  return NextResponse.json(contas);
}
