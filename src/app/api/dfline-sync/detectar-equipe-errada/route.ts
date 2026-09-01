import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizar } from "@/lib/sheetsPolling";

/**
 * Diagnóstico pontual e único: detecta linhas onde Equipe_Planilha usa um dos
 * nomes ATUAIS (Atlas/Magnum/Pipers/Base) mas o responsavel pertence a outra
 * equipe (contaminação cruzada, ex: "Atlas" com "2 - Samuel", que é do Magnum).
 * Ignora de propósito linhas com nomes de equipe antigos (Gurus/Athena/Alpha/
 * etc.) — são de outra época, com outras pessoas, e não devem ser reescritas.
 * Não corrige nada sozinho: só lista candidatos pra revisão humana antes de
 * qualquer escrita na planilha.
 */
const payloadSchema = z.object({
  pares: z.array(z.array(z.string())) // [Equipe_Planilha, responsavel][], linha 2 em diante
});

const RESPONSAVEL_POR_EQUIPE: Record<string, string[]> = {
  atlas: ["arthur", "lilian"],
  magnum: ["samuel", "glayson"],
  pipers: ["camila", "joao"],
  base: ["genisson"]
};

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

  const suspeitas: Array<{ linha: number; equipe: string; responsavel: string }> = [];
  let linhasEquipeAtual = 0;

  analisado.data.pares.forEach((par, idx) => {
    const [equipe, responsavel] = par;
    if (!equipe || !responsavel) return;
    const equipeNorm = normalizar(equipe);
    const nomesEsperados = RESPONSAVEL_POR_EQUIPE[equipeNorm];
    if (!nomesEsperados) return; // equipe fora do esquema atual (histórico) — ignora
    linhasEquipeAtual++;

    const responsavelNorm = normalizar(responsavel);
    const pertence = nomesEsperados.some((nome) => responsavelNorm.includes(nome));
    if (!pertence) {
      suspeitas.push({ linha: idx + 2, equipe, responsavel });
    }
  });

  // Contexto (±3 linhas) só para os casos isolados já confirmados com o usuário,
  // pra descobrir o valor certo pelo padrão de rodízio ao redor, sem chutar.
  const ALVOS = [231, 232, 795, 797, 800, 1047, 1083, 1116, 1122, 1128, 1135, 1142, 1207, 1336];
  const contexto: Record<number, Array<{ linha: number; equipe: string; responsavel: string }>> = {};
  for (const alvo of ALVOS) {
    const linhas: Array<{ linha: number; equipe: string; responsavel: string }> = [];
    for (let linha = alvo - 3; linha <= alvo + 3; linha++) {
      const par = analisado.data.pares[linha - 2];
      if (par) linhas.push({ linha, equipe: par[0] ?? "", responsavel: par[1] ?? "" });
    }
    contexto[alvo] = linhas;
  }

  return NextResponse.json({ linhasEquipeAtual, suspeitas, contexto });
}
