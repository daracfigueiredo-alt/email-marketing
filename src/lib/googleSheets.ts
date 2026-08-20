/**
 * Integração bidirecional com a planilha de origem dos leads (Google Sheets):
 *  - `importarLeadsDaPlanilha()` — a cada ciclo de automação, varre a planilha
 *    e cria como Lead (numa campanha configurada) qualquer linha com e-mail
 *    que ainda não esteja marcada como "enviado" na coluna de status nem já
 *    exista no sistema (mesma checagem de duplicidade da importação manual).
 *  - `marcarEnviadoNaPlanilha()` — depois que um e-mail de campanha é enviado,
 *    marca a coluna de status como "enviado" na linha do lead correspondente.
 *
 * Reaproveita o OAuth já concedido por uma conta Gmail conectada (é preciso
 * que o escopo "https://www.googleapis.com/auth/spreadsheets" tenha sido
 * autorizado — se a conta foi conectada antes desse escopo existir, é
 * necessário reconectar em Configurações para o Google reemitir o token).
 *
 * Configuração via ambiente (todas opcionais — se LEADS_SHEET_ID não estiver
 * definido, nenhuma das funções faz nada):
 *   LEADS_SHEET_ID              ID da planilha (da URL docs.google.com/spreadsheets/d/<ID>/edit)
 *   LEADS_SHEET_ABA             nome da aba (padrão: primeira aba da planilha)
 *   LEADS_SHEET_COLUNA_EMAIL    coluna com o e-mail do lead (padrão: D)
 *   LEADS_SHEET_COLUNA_NOME     coluna com o nome do lead (padrão: E)
 *   LEADS_SHEET_COLUNA_TELEFONE coluna com o telefone do lead (padrão: F)
 *   LEADS_SHEET_COLUNA_EMPRESA  coluna com a empresa do lead (padrão: G)
 *   LEADS_SHEET_COLUNA_STATUS   coluna onde ler/escrever o status (padrão: H)
 *   LEADS_SHEET_CAMPANHA_ID     campanha à qual os novos leads são atribuídos
 */
import { google } from "googleapis";
import { prisma } from "./prisma";
import { descriptografar } from "./crypto";
import { analisarLeadsImportados } from "./dedupe";
import type { LeadImportado } from "./importParser";

function configurado() {
  return !!process.env.LEADS_SHEET_ID;
}

async function getClienteAutenticado() {
  const conta = await prisma.contaEmail.findFirst({
    where: { provedor: "GMAIL", ativa: true, refreshTokenRef: { not: null } }
  });
  if (!conta?.refreshTokenRef) {
    throw new Error("Nenhuma conta Gmail conectada para autenticar no Google Sheets.");
  }
  const client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);
  client.setCredentials({ refresh_token: descriptografar(conta.refreshTokenRef) });
  return client;
}

function config() {
  return {
    sheetId: process.env.LEADS_SHEET_ID!,
    prefixoAba: process.env.LEADS_SHEET_ABA ? `${process.env.LEADS_SHEET_ABA}!` : "",
    colunaEmail: (process.env.LEADS_SHEET_COLUNA_EMAIL || "D").toUpperCase(),
    colunaNome: (process.env.LEADS_SHEET_COLUNA_NOME || "E").toUpperCase(),
    colunaTelefone: (process.env.LEADS_SHEET_COLUNA_TELEFONE || "F").toUpperCase(),
    colunaEmpresa: (process.env.LEADS_SHEET_COLUNA_EMPRESA || "G").toUpperCase(),
    colunaStatus: (process.env.LEADS_SHEET_COLUNA_STATUS || "H").toUpperCase(),
    campanhaId: process.env.LEADS_SHEET_CAMPANHA_ID || undefined
  };
}

/** Marca a linha do lead (encontrada pelo e-mail) como enviada na planilha de origem. */
export async function marcarEnviadoNaPlanilha(email: string | null | undefined) {
  if (!configurado() || !email) return;

  const { sheetId, prefixoAba, colunaEmail, colunaStatus } = config();
  const client = await getClienteAutenticado();
  const sheets = google.sheets({ version: "v4", auth: client });

  const colunaEmailValores = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${prefixoAba}${colunaEmail}:${colunaEmail}`
  });

  const linhas = colunaEmailValores.data.values ?? [];
  const alvo = email.trim().toLowerCase();
  const indiceLinha = linhas.findIndex((linha) => (linha[0] ?? "").trim().toLowerCase() === alvo);

  if (indiceLinha === -1) {
    throw new Error(`E-mail ${email} não encontrado na coluna ${colunaEmail} da planilha.`);
  }

  const numeroLinha = indiceLinha + 1; // Sheets é 1-indexado
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${prefixoAba}${colunaStatus}${numeroLinha}`,
    valueInputOption: "RAW",
    requestBody: { values: [["enviado"]] }
  });
}

/**
 * Varre a planilha e importa como Lead qualquer linha com e-mail válido cuja
 * coluna de status ainda não esteja "enviado" e que ainda não exista no
 * sistema (mesma checagem de duplicidade por e-mail/telefone da importação
 * manual). Cada lead novo já entra com o progresso de campanha zerado, pronto
 * para o motor de automação agendar o primeiro envio.
 */
export async function importarLeadsDaPlanilha() {
  if (!configurado()) return { novosLeads: 0, avaliados: 0 };

  const { sheetId, prefixoAba, colunaEmail, colunaNome, colunaTelefone, colunaEmpresa, colunaStatus, campanhaId } = config();
  if (!campanhaId) {
    console.error("[googleSheets] LEADS_SHEET_ID configurado mas LEADS_SHEET_CAMPANHA_ID está vazio — não sei em qual campanha colocar os novos leads.");
    return { novosLeads: 0, avaliados: 0 };
  }

  const client = await getClienteAutenticado();
  const sheets = google.sheets({ version: "v4", auth: client });

  const colunas = [colunaEmail, colunaNome, colunaTelefone, colunaEmpresa, colunaStatus];
  const primeiraColuna = colunas[0];
  const ultimaColuna = colunas[colunas.length - 1];
  const resposta = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${prefixoAba}${primeiraColuna}2:${ultimaColuna}` // pula o cabeçalho (linha 1)
  });

  const linhas = resposta.data.values ?? [];
  const candidatos: LeadImportado[] = [];

  for (const linha of linhas) {
    const [email, nome, telefone, empresa, status] = linha;
    if (!email) continue;
    if ((status ?? "").trim().toLowerCase() === "enviado") continue;
    candidatos.push({
      nome: (nome ?? "").trim() || "Sem nome",
      email: (email ?? "").trim() || null,
      telefone: (telefone ?? "").trim() || null,
      empresa: (empresa ?? "").trim() || null,
      documento: null,
      observacao: null
    });
  }

  if (candidatos.length === 0) return { novosLeads: 0, avaliados: 0 };

  const { linhas: analisadas } = await analisarLeadsImportados(candidatos);
  const validos = analisadas.filter((l) => l.situacao === "valido");
  if (validos.length === 0) return { novosLeads: 0, avaliados: candidatos.length };

  const leadsCriados = await prisma.$transaction(
    validos.map((l) =>
      prisma.lead.create({
        data: {
          nome: l.nome || "Sem nome",
          email: l.email,
          telefone: l.telefone,
          empresa: l.empresa,
          responsavelId: undefined,
          campanhaId,
          proximoDisparo: new Date()
        }
      })
    )
  );

  await prisma.leadCampanhaProgresso.createMany({
    data: leadsCriados.map((lead) => ({ leadId: lead.id, campanhaId }))
  });

  return { novosLeads: leadsCriados.length, avaliados: candidatos.length };
}
