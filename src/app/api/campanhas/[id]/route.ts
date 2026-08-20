import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ status: z.enum(["ATIVA", "PAUSADA", "CONCLUIDA"]) });

const schemaEdicao = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  intervaloDias: z.number().int().min(1).default(3),
  responsavelId: z.string().optional(),
  contaEmailId: z.string().optional(),
  dataInicio: z.string().optional(),
  horarioEnvio: z.string().optional(),
  etapas: z.array(z.object({ modeloId: z.string(), diasAposAnterior: z.number().int().min(1) })).min(1)
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const campanha = await prisma.campanha.findUnique({
    where: { id: params.id },
    include: { etapas: { orderBy: { ordem: "asc" } } }
  });
  if (!campanha) return NextResponse.json({ erro: "Campanha não encontrada" }, { status: 404 });
  return NextResponse.json(campanha);
}

/** Atualiza os dados da campanha e substitui por completo a sequência de etapas. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = schemaEdicao.parse(await req.json());

  const campanha = await prisma.$transaction(async (tx) => {
    await tx.campanhaEtapa.deleteMany({ where: { campanhaId: params.id } });
    return tx.campanha.update({
      where: { id: params.id },
      data: {
        nome: corpo.nome,
        descricao: corpo.descricao,
        intervaloDias: corpo.intervaloDias,
        responsavelId: corpo.responsavelId || undefined,
        contaEmailId: corpo.contaEmailId || null,
        dataInicio: corpo.dataInicio ? new Date(corpo.dataInicio) : null,
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
  });

  await registrarAuditoria({ usuarioId: usuario.id, acao: "EDITOU_CAMPANHA", entidade: "Campanha", entidadeId: campanha.id });

  return NextResponse.json(campanha);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { status } = schema.parse(await req.json());
  const campanha = await prisma.campanha.update({ where: { id: params.id }, data: { status } });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "ALTEROU_STATUS_CAMPANHA",
    entidade: "Campanha",
    entidadeId: campanha.id,
    detalhes: { status }
  });

  return NextResponse.json(campanha);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const totalLeads = await prisma.lead.count({ where: { campanhaId: params.id } });
  if (totalLeads > 0) {
    return NextResponse.json(
      { erro: `Não é possível excluir: existem ${totalLeads} lead(s) vinculados a esta campanha. Transfira ou remova os leads antes de excluir.` },
      { status: 400 }
    );
  }

  const campanha = await prisma.campanha.delete({ where: { id: params.id } });
  await registrarAuditoria({ usuarioId: usuario.id, acao: "EXCLUIU_CAMPANHA", entidade: "Campanha", entidadeId: campanha.id, detalhes: { nome: campanha.nome } });

  return NextResponse.json({ ok: true });
}
