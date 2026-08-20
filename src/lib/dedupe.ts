import { prisma } from "./prisma";
import { emailValido, telefoneValido, type LeadImportado } from "./importParser";

export interface LeadAnalisado extends LeadImportado {
  linha: number;
  situacao: "valido" | "sem_email" | "email_invalido" | "telefone_invalido" | "duplicado_planilha" | "ja_existente";
  leadExistenteId?: string;
}

export interface ResumoImportacao {
  totalLinhas: number;
  leadsValidos: number;
  leadsSemEmail: number;
  emailsInvalidos: number;
  telefonesInvalidos: number;
  duplicados: number;
  jaExistentes: number;
}

/**
 * Regra de duplicidade (seção 9 do roteiro):
 * prioridade 1) e-mail, 2) telefone, 3) identificador interno (não aplicável na importação).
 * Nunca cria dois leads iguais.
 */
export async function analisarLeadsImportados(leads: LeadImportado[]): Promise<{
  linhas: LeadAnalisado[];
  resumo: ResumoImportacao;
}> {
  const vistosEmail = new Set<string>();
  const vistosTelefone = new Set<string>();
  const linhas: LeadAnalisado[] = [];

  const resumo: ResumoImportacao = {
    totalLinhas: leads.length,
    leadsValidos: 0,
    leadsSemEmail: 0,
    emailsInvalidos: 0,
    telefonesInvalidos: 0,
    duplicados: 0,
    jaExistentes: 0
  };

  const emails = leads.map((l) => l.email).filter((e): e is string => !!e);
  const telefones = leads.map((l) => l.telefone).filter((t): t is string => !!t);

  const existentes = await prisma.lead.findMany({
    where: {
      OR: [
        emails.length ? { email: { in: emails } } : undefined,
        telefones.length ? { telefone: { in: telefones } } : undefined
      ].filter(Boolean) as any
    },
    select: { id: true, email: true, telefone: true }
  });
  const existentePorEmail = new Map(existentes.filter((e) => e.email).map((e) => [e.email as string, e.id]));
  const existentePorTelefone = new Map(existentes.filter((e) => e.telefone).map((e) => [e.telefone as string, e.id]));

  leads.forEach((lead, index) => {
    const linhaNum = index + 2; // +2 considerando cabeçalho da planilha

    if (!lead.email && !lead.telefone) {
      linhas.push({ ...lead, linha: linhaNum, situacao: "sem_email" });
      resumo.leadsSemEmail++;
      return;
    }
    if (lead.email && !emailValido(lead.email)) {
      linhas.push({ ...lead, linha: linhaNum, situacao: "email_invalido" });
      resumo.emailsInvalidos++;
      return;
    }
    if (lead.telefone && !telefoneValido(lead.telefone)) {
      linhas.push({ ...lead, linha: linhaNum, situacao: "telefone_invalido" });
      resumo.telefonesInvalidos++;
      return;
    }

    const chaveEmail = lead.email ?? undefined;
    const chaveTelefone = lead.telefone ?? undefined;

    if ((chaveEmail && vistosEmail.has(chaveEmail)) || (chaveTelefone && vistosTelefone.has(chaveTelefone))) {
      linhas.push({ ...lead, linha: linhaNum, situacao: "duplicado_planilha" });
      resumo.duplicados++;
      return;
    }

    const existenteId = (chaveEmail && existentePorEmail.get(chaveEmail)) || (chaveTelefone && existentePorTelefone.get(chaveTelefone));
    if (existenteId) {
      linhas.push({ ...lead, linha: linhaNum, situacao: "ja_existente", leadExistenteId: existenteId });
      resumo.jaExistentes++;
      return;
    }

    if (chaveEmail) vistosEmail.add(chaveEmail);
    if (chaveTelefone) vistosTelefone.add(chaveTelefone);

    linhas.push({ ...lead, linha: linhaNum, situacao: "valido" });
    resumo.leadsValidos++;
  });

  return { linhas, resumo };
}
