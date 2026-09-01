/**
 * Integração com ChatGuru.
 *
 * A API key/conta nunca ficam no frontend — apenas em variáveis de ambiente
 * (CHATGURU_API_KEY, CHATGURU_ACCOUNT_ID, CHATGURU_BASE_URL).
 *
 * Este módulo cobre os requisitos do roteiro:
 *  - criar contato no ChatGuru quando necessário (evitando duplicidade)
 *  - adicionar anotação automática (ex: "Lead respondeu ao e-mail de remarketing")
 *
 * A API do ChatGuru é UMA URL só (CHATGURU_BASE_URL), sem path por ação — a ação
 * vai num campo "action" do corpo, e o corpo é x-www-form-urlencoded, não JSON.
 * Confirmado pelo cenário Make "1 - Cadastro ChatGuru" (chat_add/chat_add_status),
 * que já funciona em produção. A versão anterior desta função montava uma URL por
 * endpoint (`${BASE_URL}${endpoint}`) e mandava JSON — por isso a anotação
 * (`/note_add`) voltava 404: essa rota nunca existiu, era um chute nunca validado.
 */
import { prisma } from "./prisma";

function configurado() {
  return !!(process.env.CHATGURU_API_KEY && process.env.CHATGURU_ACCOUNT_ID && process.env.CHATGURU_BASE_URL);
}

/**
 * O ChatGuru corrige automaticamente números de celular brasileiros que vêm com o
 * "9" extra depois do DDD (ex: 5531987654321 → 553187654321), guardando o contato
 * já com o número corrigido. Se mandarmos uma ação (como note_add) com o número
 * original de 13 dígitos, ele não bate com o que o ChatGuru guardou e a API responde
 * "Chat não encontrado" — documentado no manual de operação manual e confirmado via
 * teste direto contra a API em 2026-08-30 ao investigar leads que ficaram sem anotação.
 * Retorna o número sem o "9" quando aplicável, ou null se o formato não bate.
 */
function corrigirNumeroBrasileiro(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length === 13 && digitos.startsWith("55") && digitos[4] === "9") {
    return digitos.slice(0, 4) + digitos.slice(5);
  }
  return null;
}

/**
 * Tenta note_add com o número como veio; se o ChatGuru responder "Chat não
 * encontrado", tenta de novo uma única vez com o número sem o "9" extra do celular
 * (ver corrigirNumeroBrasileiro). Evita que a maioria dos leads novos fique sem a
 * anotação de "cadastro efetivado" por causa desse descompasso de formato.
 */
async function anotarComCorrecaoDeNumero(telefoneOriginal: string, texto: string) {
  try {
    const resultado = await chamarChatGuru("/note_add", { chat_number: telefoneOriginal, note_text: texto });
    return { resultado, telefoneUsado: telefoneOriginal, corrigido: false };
  } catch (erro: any) {
    const numeroCorrigido = corrigirNumeroBrasileiro(telefoneOriginal);
    if (!numeroCorrigido || !String(erro.message).includes("Chat não encontrado")) {
      throw erro;
    }
    const resultado = await chamarChatGuru("/note_add", { chat_number: numeroCorrigido, note_text: texto });
    return { resultado, telefoneUsado: numeroCorrigido, corrigido: true };
  }
}

async function chamarChatGuru(acao: string, body: Record<string, unknown>) {
  if (!configurado()) {
    throw new Error("Integração ChatGuru não configurada. Preencha CHATGURU_* no ambiente.");
  }
  const campos = {
    key: process.env.CHATGURU_API_KEY!,
    account_id: process.env.CHATGURU_ACCOUNT_ID!,
    phone_id: process.env.CHATGURU_PHONE_ID!,
    action: acao.replace(/^\//, ""),
    ...body
  };
  const form = new URLSearchParams();
  for (const [chave, valor] of Object.entries(campos)) {
    if (valor !== undefined && valor !== null) form.set(chave, String(valor));
  }
  const resposta = await fetch(process.env.CHATGURU_BASE_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form
  });
  if (!resposta.ok) {
    throw new Error(`ChatGuru respondeu ${resposta.status}: ${await resposta.text()}`);
  }
  return resposta.json();
}

/** Cria (ou reaproveita) o contato no ChatGuru para um lead, evitando duplicidade pelo telefone. */
export async function sincronizarContatoChatGuru(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  if (lead.chatguruContatoId) {
    return { jaExistia: true, contatoId: lead.chatguruContatoId };
  }

  try {
    const resultado = await chamarChatGuru("/chat_add", {
      nome: lead.nome,
      celular: lead.telefone,
      email: lead.email
    });
    const contatoId = (resultado as any)?.id ?? (resultado as any)?.contact_id;

    await prisma.lead.update({
      where: { id: lead.id },
      data: { chatguruContatoId: contatoId, chatguruStatus: "SINCRONIZADO", chatguruErro: null }
    });
    await prisma.chatGuruEvento.create({
      data: { leadId: lead.id, tipo: "CRIAR_CONTATO", payload: resultado as any, sucesso: true }
    });
    return { jaExistia: false, contatoId };
  } catch (erro: any) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { chatguruStatus: "ERRO", chatguruErro: erro.message }
    });
    await prisma.chatGuruEvento.create({
      data: { leadId: lead.id, tipo: "ERRO", sucesso: false, erro: erro.message }
    });
    throw erro;
  }
}

/**
 * Adiciona uma anotação automática no histórico do contato no ChatGuru.
 *
 * A entrega da anotação é feita sempre pelo número de telefone (chat_number) —
 * é assim que o ChatGuru localiza a conversa. A sincronização de contato
 * (criar/reaproveitar chatguruContatoId) é só um registro auxiliar nosso e
 * roda em paralelo, best-effort: se ela falhar, não impede a anotação de ser
 * entregue, já que a busca por telefone não depende do contatoId.
 */
export async function adicionarAnotacaoChatGuru(leadId: string, texto: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!lead.telefone) {
    throw new Error("Lead sem telefone cadastrado — o ChatGuru localiza o contato pelo número de telefone.");
  }

  if (!lead.chatguruContatoId) {
    await sincronizarContatoChatGuru(leadId).catch(() => null);
  }

  try {
    const { resultado, telefoneUsado, corrigido } = await anotarComCorrecaoDeNumero(lead.telefone, texto);
    await prisma.chatGuruEvento.create({
      data: { leadId: lead.id, tipo: "ADICIONAR_ANOTACAO", payload: { texto, resultado, telefoneUsado, corrigido }, sucesso: true }
    });
    return resultado;
  } catch (erro: any) {
    await prisma.chatGuruEvento.create({
      data: { leadId: lead.id, tipo: "ERRO", sucesso: false, erro: erro.message }
    });
    throw erro;
  }
}

/**
 * Mesma anotação de `adicionarAnotacaoChatGuru`, mas para contatos que não têm
 * (e não precisam ter) um registro na tabela Lead deste app — caso da sincronização
 * DFLINE, onde o contato já existe no ChatGuru (cadastrado pelo cenário Make "1 -
 * Cadastro ChatGuru") e só precisamos deixar uma anotação pelo número de telefone.
 */
export async function adicionarAnotacaoChatGuruPorTelefone(telefone: string, texto: string) {
  try {
    const { resultado, telefoneUsado, corrigido } = await anotarComCorrecaoDeNumero(telefone, texto);
    await prisma.chatGuruEvento.create({
      data: { leadId: null, tipo: "ADICIONAR_ANOTACAO", payload: { telefone, telefoneUsado, corrigido, texto, resultado }, sucesso: true }
    });
    return resultado;
  } catch (erro: any) {
    await prisma.chatGuruEvento.create({
      data: { leadId: null, tipo: "ERRO", payload: { telefone }, sucesso: false, erro: erro.message }
    });
    throw erro;
  }
}
