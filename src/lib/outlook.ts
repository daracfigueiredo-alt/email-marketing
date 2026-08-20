/**
 * Integração com Outlook / Microsoft 365 via Microsoft Graph API (OAuth 2.0,
 * Microsoft identity platform — "authorization code flow"). Mesmo padrão do
 * módulo gmail.ts: nenhuma credencial no frontend, refresh_token cifrado no banco.
 *
 * Para conectar uma conta de verdade:
 * 1. Registrar um app em https://portal.azure.com (Azure AD / Entra ID).
 * 2. Adicionar o redirect URI = OUTLOOK_REDIRECT_URI, com permissões (API
 *    permissions) Mail.Send e Mail.Read (delegadas), mais offline_access.
 * 3. Preencher OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_REDIRECT_URI, OUTLOOK_TENANT.
 * 4. Em Configurações, clicar em "Conectar conta Outlook".
 */
import { prisma } from "./prisma";
import { criptografar, descriptografar } from "./crypto";
import { lerAnexosParaEnvio, type AnexoInfo } from "./anexos";

const TENANT = process.env.OUTLOOK_TENANT || "common";
const AUTHORITY = `https://login.microsoftonline.com/${TENANT}`;
const ESCOPOS = ["offline_access", "Mail.Send", "Mail.Read", "User.Read"].join(" ");

export function gerarUrlAutorizacaoOutlook(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
    response_mode: "query",
    scope: ESCOPOS,
    state
  });
  return `${AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function trocarCodigoPorToken(code: string) {
  const resp = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
      grant_type: "authorization_code",
      scope: ESCOPOS
    })
  });
  if (!resp.ok) throw new Error(`Falha ao trocar código por token: ${await resp.text()}`);
  return resp.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

async function renovarAccessToken(refreshToken: string) {
  const resp = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: ESCOPOS
    })
  });
  if (!resp.ok) throw new Error(`Falha ao renovar token do Outlook: ${await resp.text()}`);
  return resp.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

/** Finaliza a conexão da conta: troca o code, busca o e-mail via Graph e salva em ContaEmail. */
export async function concluirConexaoOutlook(code: string, usuarioId: string) {
  const tokens = await trocarCodigoPorToken(code);

  const perfilResp = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  if (!perfilResp.ok) throw new Error("Falha ao obter perfil da conta Microsoft.");
  const perfil = await perfilResp.json();
  const emailConta: string = perfil.mail || perfil.userPrincipalName;

  return prisma.contaEmail.upsert({
    where: { emailConta },
    update: { refreshTokenRef: criptografar(tokens.refresh_token), ativa: true, usuarioId },
    create: {
      usuarioId,
      provedor: "OUTLOOK",
      emailConta,
      nomeRemetente: perfil.displayName || emailConta,
      refreshTokenRef: criptografar(tokens.refresh_token)
    }
  });
}

export interface EnvioResultado {
  sucesso: boolean;
  erro?: string;
}

/** Envia um e-mail via Microsoft Graph (sendMail) usando a conta conectada indicada. */
export async function enviarEmailOutlook(params: {
  para: string;
  cc?: string;
  assunto: string;
  corpoHtml: string;
  contaEmailId: string;
  anexos?: AnexoInfo[];
}): Promise<EnvioResultado> {
  try {
    const conta = await prisma.contaEmail.findUnique({ where: { id: params.contaEmailId } });
    if (!conta?.refreshTokenRef) throw new Error("Conta Outlook não encontrada ou não conectada via OAuth.");

    const { access_token } = await renovarAccessToken(descriptografar(conta.refreshTokenRef));
    const anexosComConteudo = await lerAnexosParaEnvio(params.anexos);

    const resp = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: params.assunto,
          body: { contentType: "HTML", content: params.corpoHtml },
          toRecipients: [{ emailAddress: { address: params.para } }],
          ccRecipients: params.cc ? [{ emailAddress: { address: params.cc } }] : [],
          attachments: anexosComConteudo.map((a) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: a.nome,
            contentType: a.tipo,
            contentBytes: a.base64
          }))
        },
        saveToSentItems: true
      })
    });

    if (!resp.ok) throw new Error(`Graph respondeu ${resp.status}: ${await resp.text()}`);
    return { sucesso: true };
  } catch (erro: any) {
    return { sucesso: false, erro: erro?.message ?? "Falha desconhecida ao enviar via Outlook." };
  }
}
