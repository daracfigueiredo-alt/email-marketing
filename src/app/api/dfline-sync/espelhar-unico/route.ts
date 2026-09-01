import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { unificarConsolidado, unificarRural, unificarFaturamento } from "@/lib/sheetsUnificacao";
import { normalizarTelefone } from "@/lib/sincronizacaoDfline";

/**
 * Espelho contínuo: chamado periodicamente (cenário Make) com os valores brutos
 * de uma das três abas antigas. Remapeia para o layout da aba "Consolidado Único"
 * (mesma lógica de sheetsUnificacao.ts usada na migração histórica) e devolve só
 * as linhas cujo telefone ainda não foi espelhado — a idempotência é o índice único
 * leads_espelhados_unico.telefoneNormalizado, não nenhuma marca na planilha.
 *
 * ?modo=registrar : só grava o telefone como já espelhado, sem devolver linhas —
 * usado uma única vez para marcar as linhas já copiadas manualmente na migração
 * histórica, para o espelho contínuo não duplicá-las na próxima rodada.
 *
 * O status do ChatGuru (coluna P) NÃO existe nas abas de origem — quem registra no
 * ChatGuru e escreve esse status é o cenário "1 - Cadastro ChatGuru", que hoje
 * observa a própria "Consolidado Único" (google-sheets:watchRows) depois que a
 * linha chega aqui. Ou seja, o espelho tem que copiar a linha SEMPRE que houver
 * telefone, com a coluna P em branco — é assim que a linha "aparece" pra aquele
 * cenário processar. Chegou a existir aqui uma trava exigindo status já preenchido
 * na origem antes de espelhar; ela bloqueava tudo, já que a origem nunca escreve
 * esse status — nenhuma linha nova chegava mais na Consolidado Único. Removida.
 */
const abaSchema = z.enum(["consolidado", "rural", "faturamento"]);
const modoSchema = z.enum(["espelhar", "registrar"]).default("espelhar");
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
  const modo = modoSchema.parse(req.nextUrl.searchParams.get("modo") ?? undefined);

  const corpo = await req.json().catch(() => null);
  const analisado = payloadSchema.safeParse(corpo);
  if (!analisado.success) {
    return NextResponse.json({ erro: "Payload inválido — esperado um array de linhas (array de arrays de string)" }, { status: 400 });
  }

  const unificador = { consolidado: unificarConsolidado, rural: unificarRural, faturamento: unificarFaturamento }[aba.data];
  const todasAsLinhas = unificador(analisado.data);

  const linhasNovas: string[][] = [];
  for (const linha of todasAsLinhas) {
    const telefoneNormalizado = normalizarTelefone(linha[5]);
    if (!telefoneNormalizado) continue;
    try {
      await prisma.leadEspelhadoUnico.create({ data: { telefoneNormalizado, origemAba: aba.data } });
    } catch {
      continue; // já espelhado — índice único bloqueou o insert
    }
    if (modo === "espelhar") linhasNovas.push(linha);
  }

  return NextResponse.json({ aba: aba.data, modo, linhasVistas: todasAsLinhas.length, linhasNovas: linhasNovas.length, linhas: linhasNovas });
}
