import { NextRequest, NextResponse } from "next/server";
import { registrarOptOut } from "@/lib/automacao";

/**
 * Link público de descadastro incluído no rodapé de todo e-mail de remarketing
 * (seção 31). Não exige login — é clicado pelo próprio lead a partir do e-mail.
 */
export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("lead");
  if (!leadId) return NextResponse.json({ erro: "Lead não informado" }, { status: 400 });

  await registrarOptOut(leadId);

  return new NextResponse(
    `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:sans-serif;padding:40px;text-align:center;">
      <h2>Você não receberá mais nossos e-mails</h2>
      <p>Seu pedido foi registrado com sucesso.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
