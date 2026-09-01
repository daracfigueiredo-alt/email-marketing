import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unificarConsolidado, unificarRural, unificarFaturamento } from "@/lib/sheetsUnificacao";

/**
 * Migração histórica única: recebe os valores brutos de uma das três abas antigas
 * e devolve as linhas já remapeadas para o layout fixo da aba "Consolidado Único"
 * (mesma extração por nome de cabeçalho usada em sheetsPolling.ts, mas aqui sem
 * gate de status e sem chamar a sincronização com o DFLINE — é só remapeamento de
 * coluna para preservar equipe/responsável/status exatamente como já estavam).
 */
const abaSchema = z.enum(["consolidado", "rural", "faturamento"]);
const payloadSchema = z.array(z.array(z.string()));

export async function POST(req: NextRequest) {
  const segredo = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.DFLINE_SYNC_WEBHOOK_SECRET || segredo !== process.env.DFLINE_SYNC_WEBHOOK_SECRET) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const aba = abaSchema.safeParse(req.nextUrl.searchParams.get("aba"));
  if (!aba.success) {
    return NextResponse.json({ erro: "Parâmetro ?aba= inválido — use consolidado, rural ou faturamento" }, { status: 400 });
  }

  const corpo = await req.json().catch(() => null);
  const analisado = payloadSchema.safeParse(corpo);
  if (!analisado.success) {
    return NextResponse.json({ erro: "Payload inválido — esperado um array de linhas (array de arrays de string)" }, { status: 400 });
  }

  const unificador = { consolidado: unificarConsolidado, rural: unificarRural, faturamento: unificarFaturamento }[aba.data];
  const linhas = unificador(analisado.data);

  return NextResponse.json({ aba: aba.data, linhas });
}
