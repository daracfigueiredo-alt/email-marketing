import * as XLSX from "xlsx";
import Papa from "papaparse";

/** Colunas que o sistema entende e tenta detectar automaticamente na planilha. */
export const CAMPOS_SISTEMA = [
  "nome",
  "email",
  "telefone",
  "empresa",
  "documento",
  "observacao"
] as const;
export type CampoSistema = (typeof CAMPOS_SISTEMA)[number];

// Sinônimos usados para detectar automaticamente as colunas da planilha (case-insensitive)
const SINONIMOS: Record<CampoSistema, string[]> = {
  nome: ["nome", "nome cliente", "nome completo", "cliente", "contato"],
  email: ["email", "e-mail", "e mail"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "contato telefone"],
  empresa: ["empresa", "company", "razao social", "razão social"],
  documento: ["cpf", "cnpj", "cpf/cnpj", "documento"],
  observacao: ["observacao", "observação", "obs", "notas"]
};

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function detectarMapeamento(colunas: string[]): Record<string, CampoSistema | null> {
  const mapeamento: Record<string, CampoSistema | null> = {};
  for (const coluna of colunas) {
    const colunaNorm = normalizar(coluna);
    let encontrado: CampoSistema | null = null;
    for (const campo of CAMPOS_SISTEMA) {
      if (SINONIMOS[campo].some((s) => normalizar(s) === colunaNorm)) {
        encontrado = campo;
        break;
      }
    }
    mapeamento[coluna] = encontrado;
  }
  return mapeamento;
}

/** Lê um arquivo XLSX ou CSV (buffer) e retorna as linhas como objetos { coluna: valor } */
export function lerPlanilha(buffer: Buffer, nomeArquivo: string): { colunas: string[]; linhas: Record<string, string>[] } {
  const isCsv = nomeArquivo.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const texto = buffer.toString("utf-8");
    const resultado = Papa.parse<Record<string, string>>(texto, {
      header: true,
      skipEmptyLines: true
    });
    const colunas = resultado.meta.fields ?? [];
    return { colunas, linhas: resultado.data };
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const primeiraAba = workbook.SheetNames[0];
  const planilha = workbook.Sheets[primeiraAba];
  const linhas = XLSX.utils.sheet_to_json<Record<string, string>>(planilha, { defval: "" });
  const colunas = linhas.length > 0 ? Object.keys(linhas[0]) : [];
  return { colunas, linhas };
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(email?: string | null) {
  if (!email) return false;
  return REGEX_EMAIL.test(email.trim());
}

/** Normaliza telefone para apenas dígitos, exige ao menos 10 dígitos (DDD + número) */
export function telefoneValido(telefone?: string | null) {
  if (!telefone) return false;
  const digitos = telefone.replace(/\D/g, "");
  return digitos.length >= 10 && digitos.length <= 13;
}

export function normalizarTelefone(telefone?: string | null) {
  if (!telefone) return null;
  return telefone.replace(/\D/g, "") || null;
}

export interface LeadImportado {
  nome: string;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  documento: string | null;
  observacao: string | null;
}

/** Converte as linhas cruas da planilha em leads usando o mapeamento de colunas confirmado pelo usuário */
export function mapearLinhas(
  linhas: Record<string, string>[],
  mapeamento: Record<string, CampoSistema | null>
): LeadImportado[] {
  return linhas.map((linha) => {
    const lead: Partial<LeadImportado> = {};
    for (const [coluna, campo] of Object.entries(mapeamento)) {
      if (!campo) continue;
      const valor = (linha[coluna] ?? "").toString().trim();
      if (campo === "telefone") {
        (lead as any)[campo] = normalizarTelefone(valor);
      } else {
        (lead as any)[campo] = valor || null;
      }
    }
    return {
      nome: lead.nome ?? "",
      email: lead.email ?? null,
      telefone: lead.telefone ?? null,
      empresa: lead.empresa ?? null,
      documento: lead.documento ?? null,
      observacao: lead.observacao ?? null
    };
  });
}
