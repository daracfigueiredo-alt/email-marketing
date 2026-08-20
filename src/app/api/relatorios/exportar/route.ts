import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { gerarCSV, gerarXLSX, gerarPDF } from "@/lib/exportacao";

type Tipo = "leads-por-status" | "campanhas-por-status" | "leads-por-responsavel";

async function montarDados(tipo: Tipo) {
  if (tipo === "leads-por-status") {
    const grupos = await prisma.lead.groupBy({ by: ["status"], _count: true });
    return { titulo: "Leads por status", colunas: ["Status", "Quantidade"], linhas: grupos.map((g) => [g.status, g._count]) };
  }
  if (tipo === "campanhas-por-status") {
    const grupos = await prisma.campanha.groupBy({ by: ["status"], _count: true });
    return { titulo: "Campanhas por status", colunas: ["Status", "Quantidade"], linhas: grupos.map((g) => [g.status, g._count]) };
  }
  const grupos = await prisma.lead.groupBy({ by: ["responsavelId"], _count: true });
  const usuarios = await prisma.usuario.findMany({ where: { id: { in: grupos.map((g) => g.responsavelId).filter((x): x is string => !!x) } } });
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  return {
    titulo: "Leads por responsável",
    colunas: ["Responsável", "Quantidade"],
    linhas: grupos.map((g) => [g.responsavelId ? nomes.get(g.responsavelId) ?? "—" : "Sem responsável", g._count])
  };
}

export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const tipo = (req.nextUrl.searchParams.get("tipo") as Tipo) || "leads-por-status";
  const formato = req.nextUrl.searchParams.get("formato") || "csv";
  const { titulo, colunas, linhas } = await montarDados(tipo);

  if (formato === "xlsx") {
    const buffer = gerarXLSX(colunas, linhas, titulo);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${tipo}.xlsx"` }
    });
  }
  if (formato === "pdf") {
    const buffer = await gerarPDF(titulo, colunas, linhas);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${tipo}.pdf"` } });
  }
  const csv = gerarCSV(colunas, linhas);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${tipo}.csv"` } });
}
