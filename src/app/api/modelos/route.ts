import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { z } from "zod";

const schemaAnexo = z.object({ nome: z.string(), url: z.string().optional(), tipo: z.string().optional(), tamanho: z.number().optional() });

const schema = z.object({
  nome: z.string().min(1),
  assunto: z.string().min(1),
  corpoHtml: z.string().min(1),
  anexos: z.array(schemaAnexo).optional()
});

export async function GET() {
  const modelos = await prisma.modeloEmail.findMany({ orderBy: { criadoEm: "desc" } });
  return NextResponse.json(modelos);
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = schema.parse(await req.json());
  const modelo = await prisma.modeloEmail.create({ data: corpo });

  await registrarAuditoria({ usuarioId: usuario.id, acao: "CRIOU_MODELO_EMAIL", entidade: "ModeloEmail", entidadeId: modelo.id });

  return NextResponse.json(modelo, { status: 201 });
}
