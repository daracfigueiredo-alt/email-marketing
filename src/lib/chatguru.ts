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
 * As chamadas HTTP reais dependem da documentação/credenciais específicas da conta
 * ChatGuru do cliente — os endpoints abaixo seguem o padrão REST usual da plataforma
 * e devem ser confirmados/ajustados com a doc oficial antes de ir para produção.
 */
import { prisma } from "./prisma";

function configurado() {
  return !!(process.env.CHATGURU_API_KEY && process.env.CHATGURU_ACCOUNT_ID && process.env.CHATGURU_BASE_URL);
}

async function chamarChatGuru(endpoint: string, body: Record<string, unknown>) {
  if (!configurado()) {
    throw new Error("Integração ChatGuru não configurada. Preencha CHATGURU_* no ambiente.");
  }
  const url = `${process.env.CHATGURU_BASE_URL}${endpoint}`;
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      key: process.env.CHATGURU_API_KEY,
      account_id: process.env.CHATGURU_ACCOUNT_ID,
      phone_id: process.env.CHATGURU_PHONE_ID
    })
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
    const resultado = await chamarChatGuru("/note_add", {
      chat_number: lead.telefone,
      note: texto
    });
    await prisma.chatGuruEvento.create({
      data: { leadId: lead.id, tipo: "ADICIONAR_ANOTACAO", payload: { texto, resultado }, sucesso: true }
    });
    return resultado;
  } catch (erro: any) {
    await prisma.chatGuruEvento.create({
      data: { leadId: lead.id, tipo: "ERRO", sucesso: false, erro: erro.message }
    });
    throw erro;
  }
}
