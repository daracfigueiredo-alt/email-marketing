/**
 * Integração com Gmail API (OAuth 2.0), com suporte a múltiplas contas conectadas
 * (seção 27/28) além do modo de conta única via variáveis de ambiente.
 *
 * IMPORTANTE: nenhuma credencial fica no frontend. Client ID/Secret vêm de
 * variáveis de ambiente; o refresh_token de cada conta conectada fica
 * criptografado no banco (ver src/lib/crypto.ts) e só é decifrado no servidor.
 *
 * Para conectar uma conta de verdade:
 * 1. Criar projeto no Google Cloud Console, habilitar a Gmail API.
 * 2. Criar credenciais OAuth 2.0 (tipo "Web application") com redirect URI
 *    apontando para GMAIL_REDIRECT_URI (ex: https://seu-dominio/api/integrations/gmail/callback).
 * 3. Preencher GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET no ambiente.
 * 4. Em Configurações, clicar em "Conectar conta Gmail" (fluxo OAuth completo).
 *
 * Modo legado (uma única conta via .env, sem passar pela tela de Configurações):
 * preencher também GMAIL_REFRESH_TOKEN e GMAIL_SENDER_EMAIL.
 */
import { randomUUID } from "crypto";
import { google } from "googleapis";
import { prisma } from "./prisma";
import { descriptografar } from "./crypto";
import { lerAnexosParaEnvio, type AnexoInfo, type AnexoComConteudo } from "./anexos";

async function getOAuthClientParaConta(contaEmailId?: string | null) {
  const client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);

  if (contaEmailId) {
    const conta = await prisma.contaEmail.findUnique({ where: { id: contaEmailId } });
    if (!conta || !conta.refreshTokenRef) throw new Error("Conta de e-mail não encontrada ou não conectada via OAuth.");
    client.setCredentials({ refresh_token: descriptografar(conta.refreshTokenRef) });
    return { client, remetente: conta.emailConta, nomeRemetente: conta.nomeRemetente };
  }

  // Modo legado: conta única via .env
  if (!process.env.GMAIL_REFRESH_TOKEN || !process.env.GMAIL_SENDER_EMAIL) {
    throw new Error("Nenhuma conta de e-mail conectada. Conecte uma conta em Configurações ou preencha GMAIL_REFRESH_TOKEN/GMAIL_SENDER_EMAIL.");
  }
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return { client, remetente: process.env.GMAIL_SENDER_EMAIL, nomeRemetente: process.env.GMAIL_SENDER_EMAIL };
}

function montarMimeMessage(params: {
  de: string;
  para: string;
  cc?: string;
  assunto: string;
  corpoHtml: string;
  anexos?: AnexoComConteudo[];
}) {
  const cabecalho = [
    `From: ${params.de}`,
    `To: ${params.para}`,
    params.cc ? `Cc: ${params.cc}` : undefined,
    `Subject: =?utf-8?B?${Buffer.from(params.assunto).toString("base64")}?=`,
    "MIME-Version: 1.0"
  ].filter(Boolean);

  if (!params.anexos || params.anexos.length === 0) {
    const linhas = [...cabecalho, 'Content-Type: text/html; charset="UTF-8"', "", params.corpoHtml];
    return Buffer.from(linhas.join("\r\n")).toString("base64url");
  }

  // Com anexo(s): multipart/mixed — uma parte text/html + uma parte por anexo, em base64.
  const boundary = `limite_${randomUUID()}`;
  const partes = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "",
    params.corpoHtml,
    ""
  ];
  for (const anexo of params.anexos) {
    partes.push(
      `--${boundary}`,
      `Content-Type: ${anexo.tipo}; name="${anexo.nome}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${anexo.nome}"`,
      "",
      anexo.base64,
      ""
    );
  }
  partes.push(`--${boundary}--`);

  const linhas = [...cabecalho, `Content-Type: multipart/mixed; boundary="${boundary}"`, "", ...partes];
  return Buffer.from(linhas.join("\r\n")).toString("base64url");
}

export interface EnvioResultado {
  sucesso: boolean;
  gmailMessageId?: string;
  gmailThreadId?: string;
  erro?: string;
}

/** Envia um e-mail via Gmail API, usando a conta conectada indicada (ou a conta legada única, se nenhuma for passada). */
export async function enviarEmailGmail(params: {
  para: string;
  cc?: string;
  assunto: string;
  corpoHtml: string;
  contaEmailId?: string | null;
  anexos?: AnexoInfo[];
}): Promise<EnvioResultado> {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return { sucesso: false, erro: "GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET não configurados no ambiente." };
  }

  try {
    const { client, remetente, nomeRemetente } = await getOAuthClientParaConta(params.contaEmailId);
    const gmail = google.gmail({ version: "v1", auth: client });
    const de = nomeRemetente && nomeRemetente !== remetente ? `${nomeRemetente} <${remetente}>` : remetente;
    const anexosComConteudo = await lerAnexosParaEnvio(params.anexos);
    const raw = montarMimeMessage({ de: de!, para: params.para, cc: params.cc, assunto: params.assunto, corpoHtml: params.corpoHtml, anexos: anexosComConteudo });
    const resposta = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    return { sucesso: true, gmailMessageId: resposta.data.id ?? undefined, gmailThreadId: resposta.data.threadId ?? undefined };
  } catch (erro: any) {
    return { sucesso: false, erro: erro?.message ?? "Falha desconhecida ao enviar via Gmail." };
  }
}

function extrairEmailDoCabecalho(valor?: string | null) {
  if (!valor) return null;
  const match = valor.match(/<([^>]+)>/);
  return (match ? match[1] : valor).trim().toLowerCase();
}

/**
 * Verifica novas respostas nas caixas de entrada das contas Gmail conectadas
 * (seção 18/39): busca não lidas, identifica o lead pelo remetente, grava a
 * mensagem recebida e interrompe o remarketing. Idempotente (usa gmailMessageId
 * único para não gravar a mesma mensagem duas vezes).
 *
 * Chamar periodicamente junto com o ciclo de remarketing (POST /api/automacoes/run).
 */
export async function verificarRespostasGmail() {
  const { tratarRespostaDetectada } = await import("./automacao");

  const contas = await prisma.contaEmail.findMany({ where: { provedor: "GMAIL", ativa: true } });
  let verificadas = 0;
  let novasRespostas = 0;

  for (const conta of contas) {
    if (!conta.refreshTokenRef) continue;
    try {
      const client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);
      client.setCredentials({ refresh_token: descriptografar(conta.refreshTokenRef) });
      const gmail = google.gmail({ version: "v1", auth: client });

      const lista = await gmail.users.messages.list({ userId: "me", q: "in:inbox is:unread", maxResults: 25 });
      for (const item of lista.data.messages ?? []) {
        verificadas++;
        if (!item.id) continue;

        const jaProcessada = await prisma.mensagem.findUnique({ where: { gmailMessageId: item.id } });
        if (jaProcessada) continue;

        const detalhe = await gmail.users.messages.get({ userId: "me", id: item.id, format: "metadata", metadataHeaders: ["From", "Subject"] });
        const headers = detalhe.data.payload?.headers ?? [];
        const de = extrairEmailDoCabecalho(headers.find((h) => h.name === "From")?.value);
        const assunto = headers.find((h) => h.name === "Subject")?.value ?? undefined;
        if (!de) continue;

        const lead = await prisma.lead.findFirst({ where: { email: de } });
        if (!lead) continue;

        await prisma.mensagem.create({
          data: {
            leadId: lead.id,
            direcao: "RECEBIDA",
            assunto,
            corpo: detalhe.data.snippet || "",
            de,
            para: conta.emailConta,
            pasta: "ENTRADA",
            status: "ENTREGUE",
            gmailMessageId: item.id,
            gmailThreadId: item.threadId ?? undefined
          }
        });

        await tratarRespostaDetectada(lead.id);
        novasRespostas++;

        // marca como lida para não reprocessar na próxima verificação
        await gmail.users.messages.modify({ userId: "me", id: item.id, requestBody: { removeLabelIds: ["UNREAD"] } });
      }
    } catch {
      // conta com token inválido/expirado — segue para as próximas contas.
      // um erro aqui fica visível para o admin quando ele tentar enviar por essa conta.
      continue;
    }
  }

  return { verificadas, novasRespostas };
}
