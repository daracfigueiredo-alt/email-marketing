import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { exigirAdmin } from "@/lib/session";

const ESCOPOS = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  // Usado para marcar a coluna de status como "enviado" na planilha de origem dos leads (src/lib/googleSheets.ts)
  "https://www.googleapis.com/auth/spreadsheets"
];

/** Inicia o fluxo OAuth 2.0 do Gmail (seção 27). Apenas administradores podem conectar contas. */
export async function GET(req: NextRequest) {
  const admin = await exigirAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ erro: "Apenas administradores podem conectar contas de e-mail" }, { status: 403 });

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REDIRECT_URI) {
    return NextResponse.json({ erro: "GMAIL_CLIENT_ID/SECRET/REDIRECT_URI não configurados no ambiente" }, { status: 400 });
  }

  const client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);

  // "state" carrega o id do usuário que está conectando, para vincular a conta a ele no callback
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // garante que o refresh_token seja retornado mesmo em reconexões
    scope: ESCOPOS,
    state: admin.id
  });

  return NextResponse.redirect(url);
}
