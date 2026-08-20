import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { criptografar } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/audit";

/** Callback do OAuth do Google: troca o "code" pelo refresh_token e salva a conta conectada. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const usuarioId = req.nextUrl.searchParams.get("state");
  const erroGoogle = req.nextUrl.searchParams.get("error");

  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;

  if (erroGoogle || !code || !usuarioId) {
    return NextResponse.redirect(`${baseUrl}/configuracoes?gmail_erro=${encodeURIComponent(erroGoogle || "código ausente")}`);
  }

  try {
    const client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      // Acontece quando a conta já havia autorizado antes e o Google não reemite o refresh_token.
      // Nesse caso, oriente o usuário a revogar o acesso em myaccount.google.com/permissions e tentar de novo.
      return NextResponse.redirect(`${baseUrl}/configuracoes?gmail_erro=${encodeURIComponent("Não foi possível obter o refresh_token. Revogue o acesso anterior do app em myaccount.google.com/permissions e tente novamente.")}`);
    }

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: client, version: "v2" });
    const perfil = await oauth2.userinfo.get();
    const emailConta = perfil.data.email!;

    const contaEmail = await prisma.contaEmail.upsert({
      where: { emailConta },
      update: { refreshTokenRef: criptografar(tokens.refresh_token), ativa: true, usuarioId },
      create: {
        usuarioId,
        provedor: "GMAIL",
        emailConta,
        nomeRemetente: perfil.data.name || emailConta,
        refreshTokenRef: criptografar(tokens.refresh_token)
      }
    });

    await registrarAuditoria({ usuarioId, acao: "CONECTOU_CONTA_EMAIL", entidade: "ContaEmail", entidadeId: contaEmail.id, detalhes: { emailConta } });

    return NextResponse.redirect(`${baseUrl}/configuracoes?gmail_ok=1`);
  } catch (erro: any) {
    return NextResponse.redirect(`${baseUrl}/configuracoes?gmail_erro=${encodeURIComponent(erro.message)}`);
  }
}
