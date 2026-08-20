import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { usuarioAtual } from "@/lib/session";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/** Serve um anexo previamente enviado. Exige usuário autenticado (anexos não são públicos). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // params.id vem no formato "<uuid>__<nome-original>" — nunca deixamos o valor
  // sair do diretório de uploads (bloqueia tentativas de path traversal).
  const nomeArquivo = path.basename(params.id);
  const caminho = path.join(UPLOADS_DIR, nomeArquivo);
  if (!caminho.startsWith(UPLOADS_DIR)) return NextResponse.json({ erro: "Inválido" }, { status: 400 });

  try {
    const conteudo = await readFile(caminho);
    const nomeOriginal = nomeArquivo.split("__").slice(1).join("__") || nomeArquivo;
    return new NextResponse(conteudo, {
      headers: {
        "Content-Disposition": `attachment; filename="${nomeOriginal}"`,
        "Content-Type": "application/octet-stream"
      }
    });
  } catch {
    return NextResponse.json({ erro: "Arquivo não encontrado" }, { status: 404 });
  }
}
