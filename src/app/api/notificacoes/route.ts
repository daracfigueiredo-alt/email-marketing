import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const notificacoes = await prisma.notificacao.findMany({
    where: { destinatarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 50,
    include: { lead: true }
  });
  return NextResponse.json(notificacoes);
}

export async function PATCH(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id, todas, lida } = await req.json();
  if (todas) {
    await prisma.notificacao.updateMany({ where: { destinatarioId: usuario.id, lida: false }, data: { lida: true } });
  } else {
    await prisma.notificacao.updateMany({ where: { id, destinatarioId: usuario.id }, data: { lida } });
  }
  return NextResponse.json({ ok: true });
}
