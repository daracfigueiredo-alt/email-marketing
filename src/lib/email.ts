/**
 * Dispatcher único de envio: decide entre Gmail e Outlook conforme o provedor
 * da ContaEmail selecionada (ou usa o modo legado de conta única via .env
 * quando nenhuma conta é informada). Todo o resto do sistema (automação,
 * resposta manual) deve chamar `enviarEmail`, nunca os módulos gmail/outlook direto.
 */
import { prisma } from "./prisma";
import { enviarEmailGmail } from "./gmail";
import { enviarEmailOutlook } from "./outlook";
import type { AnexoInfo } from "./anexos";

export interface EnvioResultado {
  sucesso: boolean;
  gmailMessageId?: string;
  gmailThreadId?: string;
  erro?: string;
}

export async function enviarEmail(params: {
  para: string;
  cc?: string;
  assunto: string;
  corpoHtml: string;
  contaEmailId?: string | null;
  anexos?: AnexoInfo[];
}): Promise<EnvioResultado> {
  if (!params.contaEmailId) {
    // Sem conta específica: usa o modo legado Gmail via variáveis de ambiente
    return enviarEmailGmail(params);
  }

  const conta = await prisma.contaEmail.findUnique({ where: { id: params.contaEmailId } });
  if (!conta) return { sucesso: false, erro: "Conta de e-mail não encontrada." };
  if (!conta.ativa) return { sucesso: false, erro: "Conta de e-mail está inativa." };

  if (conta.provedor === "OUTLOOK" || conta.provedor === "MICROSOFT_365") {
    const resultado = await enviarEmailOutlook({ ...params, contaEmailId: params.contaEmailId });
    return resultado;
  }

  return enviarEmailGmail(params);
}
