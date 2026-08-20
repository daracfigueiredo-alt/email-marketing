import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { gerarCSV, gerarXLSX, gerarPDF } from "@/lib/exportacao";

/** Relatório de campanha (seção 44): totais de envio, entrega, falha, resposta, taxa de resposta, opt-outs e avanço de funil. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const formato = req.nextUrl.searchParams.get("formato") || "csv";

  const campanha = await prisma.campanha.findUniqueOrThrow({ where: { id: params.id }, include: { responsavel: true, leads: true } });

  const totalLeads = campanha.leads.length;
  const enviados = await prisma.mensagem.count({ where: { direcao: "ENVIADA", status: { in: ["ENVIADO", "ENTREGUE"] }, lead: { campanhaId: campanha.id } } });
  const entregues = await prisma.mensagem.count({ where: { direcao: "ENVIADA", status: "ENTREGUE", lead: { campanhaId: campanha.id } } });
  const falhas = await prisma.mensagem.count({ where: { direcao: "ENVIADA", status: "FALHOU", lead: { campanhaId: campanha.id } } });
  const respostas = campanha.leads.filter((l) => l.ultimaResposta).length;
  const optOuts = campanha.leads.filter((l) => l.optOut).length;
  const avancaram = campanha.leads.filter((l) => ["INTERESSADO", "REUNIAO", "CONVERTIDO"].includes(l.status)).length;
  const taxaResposta = totalLeads > 0 ? `${((respostas / totalLeads) * 100).toFixed(1)}%` : "0%";

  const colunas = ["Campanha", "Responsável", "Total de leads", "Enviados", "Entregues", "Falhas", "Respostas", "Taxa de resposta", "Opt-outs", "Leads que avançaram"];
  const linha = [campanha.nome, campanha.responsavel?.nome ?? "—", totalLeads, enviados, entregues, falhas, respostas, taxaResposta, optOuts, avancaram];

  const nomeBase = `relatorio-${campanha.nome.replace(/[^\w]+/g, "-").toLowerCase()}`;

  if (formato === "xlsx") {
    const buffer = gerarXLSX(colunas, [linha], "Relatório de campanha");
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${nomeBase}.xlsx"` }
    });
  }
  if (formato === "pdf") {
    const buffer = await gerarPDF(`Relatório — ${campanha.nome}`, colunas, [linha]);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nomeBase}.pdf"` } });
  }
  const csv = gerarCSV(colunas, [linha]);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nomeBase}.csv"` } });
}
