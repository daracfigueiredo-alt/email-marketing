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
  ativo: z.boolean().optional(),
  anexos: z.array(schemaAnexo).optional()
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const modelo = await prisma.modeloEmail.findUnique({ where: { id: params.id } });
  if (!modelo) return NextResponse.json({ erro: "Modelo não encontrado" }, { status: 404 });
  return NextResponse.json(modelo);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const dados = schema.parse(await req.json());
  const modelo = await prisma.modeloEmail.update({ where: { id: params.id }, data: dados });

  await registrarAuditoria({ usuarioId: usuario.id, acao: "EDITOU_MODELO_EMAIL", entidade: "ModeloEmail", entidadeId: modelo.id });

  return NextResponse.json(modelo);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const emUso = await prisma.campanhaEtapa.findFirst({ where: { modeloId: params.id }, include: { campanha: true } });
  if (emUso) {
    return NextResponse.json(
      { erro: `Não é possível excluir: este modelo está em uso na campanha "${emUso.campanha.nome}". Remova-o da campanha primeiro.` },
      { status: 400 }
    );
  }

  await prisma.modeloEmail.delete({ where: { id: params.id } });
  await registrarAuditoria({ usuarioId: usuario.id, acao: "EXCLUIU_MODELO_EMAIL", entidade: "ModeloEmail", entidadeId: params.id });

  return NextResponse.json({ ok: true });
}
