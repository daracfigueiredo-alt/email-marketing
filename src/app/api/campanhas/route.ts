import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  intervaloDias: z.number().int().min(1).default(3),
  responsavelId: z.string().optional(),
  contaEmailId: z.string().optional(),
  dataInicio: z.string().optional(),
  horarioEnvio: z.string().optional(),
  etapas: z.array(z.object({ modeloId: z.string(), diasAposAnterior: z.number().int().min(1) })).min(1)
});

export async function GET() {
  const campanhas = await prisma.campanha.findMany({
    include: { etapas: true, _count: { select: { leads: true } } },
    orderBy: { criadoEm: "desc" }
  });
  return NextResponse.json(campanhas);
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = schema.parse(await req.json());

  const campanha = await prisma.campanha.create({
    data: {
      nome: corpo.nome,
      descricao: corpo.descricao,
      intervaloDias: corpo.intervaloDias,
      criadorId: usuario.id,
      responsavelId: corpo.responsavelId || usuario.id,
      contaEmailId: corpo.contaEmailId || undefined,
      dataInicio: corpo.dataInicio ? new Date(corpo.dataInicio) : undefined,
      horarioEnvio: corpo.horarioEnvio,
      etapas: {
        create: corpo.etapas.map((etapa, index) => ({
          ordem: index,
          modeloId: etapa.modeloId,
          diasAposAnterior: etapa.diasAposAnterior
        }))
      }
    },
    include: { etapas: true }
  });

  await registrarAuditoria({ usuarioId: usuario.id, acao: "CRIOU_CAMPANHA", entidade: "Campanha", entidadeId: campanha.id });

  return NextResponse.json(campanha, { status: 201 });
}
