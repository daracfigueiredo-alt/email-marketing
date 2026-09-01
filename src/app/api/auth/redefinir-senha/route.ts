import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ token: z.string().min(1), novaSenha: z.string().min(6) });

export async function POST(req: NextRequest) {
  const corpo = schema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Senha deve ter pelo menos 6 caracteres." }, { status: 400 });
  }

  const usuario = await prisma.usuario.findFirst({
    where: { resetSenhaToken: corpo.data.token, resetSenhaExpira: { gt: new Date() } }
  });
  if (!usuario) {
    return NextResponse.json({ erro: "Link inválido ou expirado. Peça uma nova redefinição." }, { status: 400 });
  }

  const senhaHash = await bcrypt.hash(corpo.data.novaSenha, 10);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash, resetSenhaToken: null, resetSenhaExpira: null }
  });

  return NextResponse.json({ ok: true });
}
