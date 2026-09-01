import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sincronizarLeadDfline } from "@/lib/sincronizacaoDfline";

/**
 * Chamado pelo cenário Make.com "1 - Cadastro ChatGuru" (planilha "funil 2.1")
 * logo após ele registrar o lead no ChatGuru — cria o card correspondente no
 * DFLINE (funil "Card criado/novo", coluna "NOVO LEAD") e deixa a anotação de
 * confirmação no ChatGuru. Autenticado por segredo compartilhado, não por sessão
 * (chamada servidor-a-servidor, sem usuário logado):
 *   Authorization: Bearer $DFLINE_SYNC_WEBHOOK_SECRET
 */
const payloadSchema = z.object({
  origemAba: z.enum(["CONSOLIDADO_2_1_5", "PRODUTOR_RURAL"]),
  contato: z.string().min(1),
  empresa: z.string().optional(),
  telefone: z.string().min(1),
  email: z.string().optional(),
  equipe: z.string().optional(),
  responsavel: z.string().optional(),
  cnpj: z.string().optional(),
  faixaDivida: z.string().optional(),
  situacaoDivida: z.string().optional(),
  meiosContato: z.string().optional(),
  campanhaCriativo: z.string().optional(),
  dataEntrada: z.string().optional(),
  observacao: z.string().optional()
});

async function lerCorpo(req: NextRequest): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      return await req.json();
    }
    // O cenário Make "1 - Cadastro ChatGuru" envia application/x-www-form-urlencoded,
    // no mesmo padrão dos demais passos HTTP daquele cenário.
    const dados = await req.formData();
    return Object.fromEntries(dados.entries());
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const segredo = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.DFLINE_SYNC_WEBHOOK_SECRET || segredo !== process.env.DFLINE_SYNC_WEBHOOK_SECRET) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const corpo = await lerCorpo(req);
  const analisado = payloadSchema.safeParse(corpo);
  if (!analisado.success) {
    return NextResponse.json({ erro: "Payload inválido", detalhes: analisado.error.flatten() }, { status: 400 });
  }

  try {
    const resultado = await sincronizarLeadDfline(analisado.data);
    return NextResponse.json(resultado);
  } catch (erro: any) {
    return NextResponse.json({ erro: erro.message }, { status: 500 });
  }
}
