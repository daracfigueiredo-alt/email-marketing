import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { exigirAdmin as exigirAdminGuard } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  login: z.string().min(3),
  senha: z.string().min(6),
  perfil: z.enum(["ADMINISTRADOR", "SUPERVISOR", "OPERADOR"])
});

export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nome: true, email: true, login: true, perfil: true, status: true, criadoEm: true, ultimoAcesso: true },
    orderBy: { criadoEm: "desc" }
  });
  return NextResponse.json(usuarios);
}

// Apenas ADMINISTRADOR pode criar usuários (seção 4 do roteiro)
export async function POST(req: NextRequest) {
  const admin = await exigirAdminGuard().catch(() => null);
  if (!admin) return NextResponse.json({ erro: "Apenas administradores podem criar usuários" }, { status: 403 });

  const corpo = schema.parse(await req.json());
  const senhaHash = await bcrypt.hash(corpo.senha, 12);

  const usuario = await prisma.usuario.create({
    data: { nome: corpo.nome, email: corpo.email, login: corpo.login, senhaHash, perfil: corpo.perfil }
  });

  await registrarAuditoria({ usuarioId: admin.id, acao: "CRIOU_USUARIO", entidade: "Usuario", entidadeId: usuario.id });

  return NextResponse.json({ id: usuario.id }, { status: 201 });
}
