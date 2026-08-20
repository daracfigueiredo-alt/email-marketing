import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(1),
  senhaAtual: z.string().optional(),
  novaSenha: z.string().min(6).optional()
});

export async function PATCH(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = schema.parse(await req.json());
  const registro = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });

  const data: any = { nome: corpo.nome };

  if (corpo.novaSenha) {
    if (!corpo.senhaAtual || !(await bcrypt.compare(corpo.senhaAtual, registro.senhaHash))) {
      return NextResponse.json({ erro: "Senha atual incorreta" }, { status: 400 });
    }
    data.senhaHash = await bcrypt.hash(corpo.novaSenha, 12);
  }

  await prisma.usuario.update({ where: { id: usuario.id }, data });
  await registrarAuditoria({ usuarioId: usuario.id, acao: "ATUALIZOU_PERFIL", entidade: "Usuario", entidadeId: usuario.id });

  return NextResponse.json({ ok: true });
}
