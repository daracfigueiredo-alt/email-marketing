import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processarConsolidado, processarRural, processarFaturamento, processarConsolidadoUnico } from "@/lib/sheetsPolling";

/**
 * Chamado periodicamente (a cada poucos minutos) por um cenário Make simples — um
 * módulo lê os valores brutos de UMA aba ("consolidado 2.1.5" / "PRODUTOR RURAL" /
 * "Formulário por Faturamento") e reenvia aqui como o corpo da requisição (array 2D
 * puro, sem wrapper), indicando qual aba é via ?aba=. Um valor por aba por chamada
 * evita ter que montar JSON manualmente no Make combinando três fontes — cada
 * módulo do Make só encaminha a saída bruta do módulo de leitura anterior.
 *
 * Toda a lógica de "o que é novo" e "para onde mandar" mora neste app, não no
 * Make. Substitui a tentativa anterior de usar o gatilho "linha nova" do Make
 * (google-sheets:watchRows), que se mostrou frágil: o marcador de posição dele se
 * perde toda vez que o cenário é reaberto/salvo pela interface do Make (ver
 * memória do projeto). Reenviar a aba inteira a cada execução é seguro porque a
 * deduplicação real é o índice único LeadDflineImportado.telefoneNormalizado, não
 * nenhuma marca escrita de volta na planilha.
 */
const abaSchema = z.enum(["consolidado", "rural", "faturamento", "unico"]);
const payloadSchema = z.array(z.array(z.string()));

export async function POST(req: NextRequest) {
  const segredo = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.DFLINE_SYNC_WEBHOOK_SECRET || segredo !== process.env.DFLINE_SYNC_WEBHOOK_SECRET) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const aba = abaSchema.safeParse(req.nextUrl.searchParams.get("aba"));
  if (!aba.success) {
    return NextResponse.json({ erro: "Parâmetro ?aba= inválido — use consolidado, rural, faturamento ou unico" }, { status: 400 });
  }

  const corpo = await req.json().catch(() => null);
  const analisado = payloadSchema.safeParse(corpo);
  if (!analisado.success) {
    return NextResponse.json({ erro: "Payload inválido — esperado um array de linhas (array de arrays de string)" }, { status: 400 });
  }

  const processador = {
    consolidado: processarConsolidado,
    rural: processarRural,
    faturamento: processarFaturamento,
    unico: processarConsolidadoUnico
  }[aba.data];
  const resultado = await processador(analisado.data);

  return NextResponse.json({ aba: aba.data, ...resultado });
}
