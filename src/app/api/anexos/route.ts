import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { usuarioAtual } from "@/lib/session";

/**
 * Upload de anexos (seção 22): PDF, DOCX, XLSX, JPG, PNG e outros formatos comuns.
 *
 * Armazenamento: disco local em `uploads/` na raiz do projeto — funciona bem
 * para desenvolvimento e para um servidor único. Em produção com múltiplas
 * instâncias, troque por um storage compartilhado (S3, Google Cloud Storage,
 * Azure Blob) mantendo a mesma interface: subir o arquivo e devolver uma URL.
 */
// Anexos são enviados em base64 (~33% maior) dentro do e-mail — o Gmail limita a
// mensagem completa a 25MB, então 15MB de anexo bruto deixa margem para isso.
const TAMANHO_MAXIMO_MB = 15;
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo) return NextResponse.json({ erro: "Nenhum arquivo enviado" }, { status: 400 });

  if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    return NextResponse.json({ erro: `Arquivo maior que ${TAMANHO_MAXIMO_MB}MB (limite também depende do provedor de e-mail)` }, { status: 400 });
  }

  await mkdir(UPLOADS_DIR, { recursive: true });

  const id = randomUUID();
  const nomeSanitizado = arquivo.name.replace(/[^\w.\-]/g, "_");
  const nomeArquivoNoDisco = `${id}__${nomeSanitizado}`;
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  await writeFile(path.join(UPLOADS_DIR, nomeArquivoNoDisco), buffer);

  return NextResponse.json({
    nome: arquivo.name,
    url: `/api/anexos/${id}__${nomeSanitizado}`,
    tipo: arquivo.type || "application/octet-stream",
    tamanho: arquivo.size
  });
}
