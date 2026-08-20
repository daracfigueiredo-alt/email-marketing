import { NextRequest, NextResponse } from "next/server";
import { executarCicloRemarketing } from "@/lib/automacao";
import { verificarRespostasGmail } from "@/lib/gmail";
import { usuarioAtual } from "@/lib/session";

/**
 * Endpoint chamado por um agendador externo (cron) a cada hora, por exemplo:
 *   curl -X POST https://seu-dominio/api/automacoes/run -H "Authorization: Bearer $AUTOMACAO_SECRET"
 *
 * Também pode ser chamado a partir da tela Automações por um usuário logado
 * (botão "Rodar agora"), autenticado via sessão em vez do segredo.
 */
export async function POST(req: NextRequest) {
  const segredo = req.headers.get("authorization")?.replace("Bearer ", "");
  const segredoValido = process.env.AUTOMACAO_SECRET && segredo === process.env.AUTOMACAO_SECRET;
  const usuario = await usuarioAtual();

  if (!segredoValido && !usuario) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  // Sincroniza respostas recebidas antes de disparar a próxima leva — evita
  // mandar mais um e-mail para quem acabou de responder (seção 39).
  const sincronizacao = await verificarRespostasGmail().catch((erro) => ({ verificadas: 0, novasRespostas: 0, erro: String(erro) }));
  const resultado = await executarCicloRemarketing();

  return NextResponse.json({ ...resultado, sincronizacaoRespostas: sincronizacao });
}
