import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { detectarMapeamento, lerPlanilha } from "@/lib/importParser";

/**
 * Recebe o arquivo (XLSX/CSV) e devolve: colunas encontradas + mapeamento
 * sugerido automaticamente, para o usuário confirmar antes de importar (seção 7).
 */
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo) return NextResponse.json({ erro: "Nenhum arquivo enviado" }, { status: 400 });

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const { colunas, linhas } = lerPlanilha(buffer, arquivo.name);
  const mapeamentoSugerido = detectarMapeamento(colunas);

  return NextResponse.json({
    arquivoNome: arquivo.name,
    colunas,
    mapeamentoSugerido,
    totalLinhas: linhas.length,
    amostra: linhas.slice(0, 5)
  });
}
