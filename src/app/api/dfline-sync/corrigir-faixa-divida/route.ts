import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mapearCabecalho, acharColuna, valor, normalizar } from "@/lib/sheetsPolling";
import { normalizarTelefone } from "@/lib/sincronizacaoDfline";

/**
 * Correção pontual e única: o bug do Faixa_Divida (comparava com texto acentuado
 * e com dois-pontos contra chaves já normalizadas, nunca batia — ver commit da
 * correção) deixou a coluna H vazia para toda linha de origem CONSOLIDADO já
 * gravada na aba única antes da correção. Em vez de reconstruir a aba inteira
 * (o que apagaria o status do ChatGuru já processado nos dias seguintes pelas
 * linhas novas), isso casa por telefone com a aba "consolidado 2.1.5" original e
 * devolve só as células H que precisam ser corrigidas, prontas para um
 * spreadsheets.values:batchUpdate — nenhuma outra coluna é tocada.
 */
const payloadSchema = z.object({
  original: z.array(z.array(z.string())),
  unico: z.array(z.array(z.string()))
});

export async function POST(req: NextRequest) {
  const segredo = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.DFLINE_SYNC_WEBHOOK_SECRET || segredo !== process.env.DFLINE_SYNC_WEBHOOK_SECRET) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const corpo = await req.json().catch(() => null);
  const analisado = payloadSchema.safeParse(corpo);
  if (!analisado.success) {
    return NextResponse.json({ erro: "Payload inválido", detalhes: analisado.error.flatten() }, { status: 400 });
  }
  const { original, unico } = analisado.data;
  if (!original.length || !unico.length) {
    return NextResponse.json({ erro: "Planilhas vazias" }, { status: 400 });
  }

  const indicesOriginal = mapearCabecalho(original[0]);
  const iTelefoneOriginal = acharColuna(indicesOriginal, ["telefone"]);
  const iFaixaDividaOriginal = acharColuna(indicesOriginal, [], ["sua divida e"]);

  const faixaPorTelefone = new Map<string, string>();
  for (let i = 1; i < original.length; i++) {
    const row = original[i];
    if (!row || !row.length) continue;
    const tel = normalizarTelefone(valor(row, iTelefoneOriginal));
    const faixa = valor(row, iFaixaDividaOriginal);
    if (tel && faixa) faixaPorTelefone.set(tel, faixa);
  }

  const indicesUnico = mapearCabecalho(unico[0]);
  const iOrigem = acharColuna(indicesUnico, ["origem"]);
  const iTelefoneUnico = acharColuna(indicesUnico, ["telefone"]);
  const iFaixaDividaUnico = acharColuna(indicesUnico, ["faixa divida"]);

  const data: Array<{ range: string; values: string[][] }> = [];
  for (let i = 1; i < unico.length; i++) {
    const row = unico[i];
    if (!row || !row.length) continue;
    if (normalizar(valor(row, iOrigem)) !== "consolidado") continue;
    if (valor(row, iFaixaDividaUnico)) continue; // já preenchida — não sobrescreve
    const tel = normalizarTelefone(valor(row, iTelefoneUnico));
    const faixa = tel ? faixaPorTelefone.get(tel) : undefined;
    if (!faixa) continue;
    const numeroLinha = i + 1; // 1-indexado, +1 pelo header já contado no loop
    data.push({ range: `Consolidado Único!H${numeroLinha}`, values: [[faixa]] });
  }

  return NextResponse.json({ totalLinhasUnico: unico.length - 1, corrigidas: data.length, data, valueInputOption: "USER_ENTERED" });
}
