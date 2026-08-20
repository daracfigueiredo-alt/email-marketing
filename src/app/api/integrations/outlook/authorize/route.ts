import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/session";
import { gerarUrlAutorizacaoOutlook } from "@/lib/outlook";

export async function GET() {
  const admin = await exigirAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ erro: "Apenas administradores podem conectar contas de e-mail" }, { status: 403 });

  if (!process.env.OUTLOOK_CLIENT_ID || !process.env.OUTLOOK_CLIENT_SECRET || !process.env.OUTLOOK_REDIRECT_URI) {
    return NextResponse.json({ erro: "OUTLOOK_CLIENT_ID/SECRET/REDIRECT_URI não configurados no ambiente" }, { status: 400 });
  }

  return NextResponse.redirect(gerarUrlAutorizacaoOutlook(admin.id));
}
