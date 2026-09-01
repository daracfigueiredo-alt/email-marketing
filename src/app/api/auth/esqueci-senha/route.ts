import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email";

const schema = z.object({ login: z.string().min(1) });

/**
 * Sempre responde OK, exista ou não o usuário — evita que alguém descubra
 * quais e-mails/logins têm conta só tentando "esqueci minha senha".
 */
export async function POST(req: NextRequest) {
  const corpo = schema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "Informe seu e-mail ou usuário." }, { status: 400 });

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ email: corpo.data.login }, { login: corpo.data.login }], status: "ATIVO" }
  });

  if (usuario) {
    const token = randomBytes(32).toString("hex");
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { resetSenhaToken: token, resetSenhaExpira: new Date(Date.now() + 60 * 60 * 1000) }
    });

    const contaRemetente = await prisma.contaEmail.findFirst({ where: { ativa: true } });
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const link = `${base}/redefinir-senha?token=${token}`;

    if (contaRemetente) {
      await enviarEmail({
        para: usuario.email,
        assunto: "Redefinição de senha",
        corpoHtml: `<p>Olá, ${usuario.nome}.</p><p>Clique no link abaixo para redefinir sua senha. Ele expira em 1 hora.</p><p><a href="${link}">${link}</a></p><p>Se você não pediu essa redefinição, ignore este e-mail.</p>`,
        contaEmailId: contaRemetente.id
      }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true });
}
