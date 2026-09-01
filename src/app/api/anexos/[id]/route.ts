import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { usuarioAtual } from "@/lib/session";

/** Serve um anexo previamente enviado, a partir do Vercel Blob (privado). Exige usuário autenticado. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const pathnameNoBlob = params.id;
  const nomeOriginal = pathnameNoBlob.split("__").slice(1).join("__") || pathnameNoBlob;

  try {
    const resultado = await get(pathnameNoBlob, { access: "private" });
    if (!resultado || !resultado.stream) return NextResponse.json({ erro: "Arquivo não encontrado" }, { status: 404 });

    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Disposition": `attachment; filename="${nomeOriginal}"`,
        "Content-Type": resultado.blob.contentType || "application/octet-stream"
      }
    });
  } catch {
    return NextResponse.json({ erro: "Arquivo não encontrado" }, { status: 404 });
  }
}
