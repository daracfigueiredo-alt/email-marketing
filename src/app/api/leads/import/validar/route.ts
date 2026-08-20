import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { lerPlanilha, mapearLinhas, type CampoSistema } from "@/lib/importParser";
import { analisarLeadsImportados } from "@/lib/dedupe";

/**
 * Recebe o arquivo + mapeamento de colunas confirmado pelo usuário e devolve
 * a pré-visualização com contagens (válidos, sem e-mail, inválidos, duplicados,
 * já existentes) — seção 8 do roteiro.
 */
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File | null;
  const mapeamentoRaw = formData.get("mapeamento") as string | null;
  if (!arquivo || !mapeamentoRaw) return NextResponse.json({ erro: "Arquivo ou mapeamento ausente" }, { status: 400 });

  const mapeamento: Record<string, CampoSistema | null> = JSON.parse(mapeamentoRaw);
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const { linhas } = lerPlanilha(buffer, arquivo.name);
  const leadsImportados = mapearLinhas(linhas, mapeamento);

  const { linhas: linhasAnalisadas, resumo } = await analisarLeadsImportados(leadsImportados);

  return NextResponse.json({ resumo, linhas: linhasAnalisadas.slice(0, 200) });
}
