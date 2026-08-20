import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GIF transparente 1x1 (43 bytes) — o menor formato de imagem válido.
const PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7", "base64");

/**
 * Pixel de rastreamento de abertura (seção "visualizado", ✓✓ estilo WhatsApp).
 * Público — carregado pelo cliente de e-mail do lead, sem autenticação de sessão
 * (ver exceção em middleware.ts). Sujeito a bloqueio de imagem remota pelo
 * provedor do lead, então nunca é garantia de leitura — apenas um indicativo.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.mensagem
    .updateMany({
      where: { id: params.id, visualizadaEm: null },
      data: { visualizadaEm: new Date() }
    })
    .catch(() => null);

  return new NextResponse(PIXEL_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Content-Length": String(PIXEL_GIF.length)
    }
  });
}
