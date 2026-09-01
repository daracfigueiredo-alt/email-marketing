import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { usuarioAtual } from "@/lib/session";

/**
 * Upload de anexos (seção 22): PDF, DOCX, XLSX, JPG, PNG e outros formatos comuns.
 *
 * Armazenamento: Vercel Blob, em modo privado — o arquivo só pode ser lido de
 * volta com o BLOB_READ_WRITE_TOKEN do servidor (nunca fica público na internet).
 * A rota GET /api/anexos/[id] é quem intermedia o acesso, exigindo login.
 */
// Anexos são enviados em base64 (~33% maior) dentro do e-mail — o Gmail limita a
// mensagem completa a 25MB, então 15MB de anexo bruto deixa margem para isso.
const TAMANHO_MAXIMO_MB = 15;

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo) return NextResponse.json({ erro: "Nenhum arquivo enviado" }, { status: 400 });

  if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    return NextResponse.json({ erro: `Arquivo maior que ${TAMANHO_MAXIMO_MB}MB (limite também depende do provedor de e-mail)` }, { status: 400 });
  }

  const id = randomUUID();
  const nomeSanitizado = arquivo.name.replace(/[^\w.\-]/g, "_");
  const pathnameNoBlob = `${id}__${nomeSanitizado}`;
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  await put(pathnameNoBlob, buffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: arquivo.type || "application/octet-stream"
  });

  return NextResponse.json({
    nome: arquivo.name,
    url: `/api/anexos/${pathnameNoBlob}`,
    tipo: arquivo.type || "application/octet-stream",
    tamanho: arquivo.size
  });
}
