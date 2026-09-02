/**
 * Sincronização Google Sheets → DFLINE, modo polling (sem depender de gatilhos
 * "linha nova" do Make, que se mostraram frágeis — ver memória do projeto).
 *
 * Este módulo recebe os valores brutos (array 2D, cabeçalho na primeira linha)
 * de duas abas da planilha "funil 2.1" e decide o que sincronizar. A idempotência
 * não depende de nenhuma marca escrita de volta na planilha — o índice único
 * LeadDflineImportado.telefoneNormalizado já garante que o mesmo lead nunca é
 * processado duas vezes, então é seguro reenviar a planilha inteira a cada
 * execução (o Make só precisa buscar os valores e chamar este endpoint).
 *
 * Colunas são resolvidas por NOME do cabeçalho (tolerante a acento/caixa/underscore),
 * nunca por posição fixa — os cabeçalhos diferem entre as três abas (a de
 * Faturamento usa formato "snake_case_com_pontuação_no_meio").
 */
import { sincronizarLeadDfline, type PayloadSincronizacaoDfline } from "./sincronizacaoDfline";

export function normalizar(valor: string) {
  return (valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_?.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapearCabecalho(header: string[]) {
  const indices = new Map<string, number>();
  header.forEach((h, i) => indices.set(normalizar(h), i));
  return indices;
}

/** Acha o índice de coluna cujo cabeçalho normalizado é exatamente igual, ou (fallback) contém, um dos candidatos. */
export function acharColuna(indices: Map<string, number>, candidatosExatos: string[], candidatosContem: string[] = []): number | undefined {
  for (const c of candidatosExatos) {
    const idx = indices.get(c);
    if (idx !== undefined) return idx;
  }
  for (const [header, idx] of indices) {
    if (candidatosContem.some((c) => header.includes(c))) return idx;
  }
  return undefined;
}

export function valor(row: string[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return (row[idx] ?? "").toString().trim();
}

export type ResultadoPollingAba = {
  linhasVistas: number;
  candidatos: number;
  sincronizados: number;
  duplicados: number;
  erros: Array<{ linha: number; erro: string }>;
};

/** Aba "consolidado 2.1.5" — só sincroniza linhas cujo cadastro no ChatGuru já foi concluído (status contém CADASTRADO_CHATGURU). */
export async function processarConsolidado(valores: string[][]): Promise<ResultadoPollingAba> {
  const resultado: ResultadoPollingAba = { linhasVistas: 0, candidatos: 0, sincronizados: 0, duplicados: 0, erros: [] };
  if (!valores.length) return resultado;

  const indices = mapearCabecalho(valores[0]);
  const iContato = acharColuna(indices, ["nome do responsavel"]);
  const iTelefone = acharColuna(indices, ["telefone"]);
  const iEmpresa = acharColuna(indices, ["nome da empresa"]);
  const iEquipe = acharColuna(indices, [], ["equipe"]);
  const iResponsavel = acharColuna(indices, ["responsavel"]);
  const iStatusChat = acharColuna(indices, [], ["adcionado ao chat", "adicionado ao chat"]);
  const iEmail = acharColuna(indices, ["e-mail", "email"]);
  const iCnpj = acharColuna(indices, [], ["cnpj"]);
  const iFaixaDivida = acharColuna(indices, [], ["sua divida e"]);
  const iSituacaoDivida = acharColuna(indices, [], ["situacao da divida", "situação da dívida"]);
  const iMeiosContato = acharColuna(indices, ["meios de contato"]);
  const iCampanha = acharColuna(indices, ["criativo"]); // coluna "criativo" (D) — não "campanha" (A), pedido do usuário
  const iDataEntrada = acharColuna(indices, ["data de entrada"]);
  const iObservacao = acharColuna(indices, [], ["observacao", "observação"]);

  for (let linha = 1; linha < valores.length; linha++) {
    const row = valores[linha];
    if (!row || !row.length) continue;
    resultado.linhasVistas++;

    const statusChat = normalizar(valor(row, iStatusChat));
    if (!statusChat.includes("cadastrado chatguru")) continue; // normalizar() troca "_" por espaço — só sincroniza depois do ChatGuru concluído
    const telefone = valor(row, iTelefone);
    if (!telefone) continue;
    resultado.candidatos++;

    const payload: PayloadSincronizacaoDfline = {
      origemAba: "CONSOLIDADO_2_1_5",
      contato: valor(row, iContato) || "Sem nome",
      empresa: valor(row, iEmpresa) || undefined,
      telefone,
      email: valor(row, iEmail) || undefined,
      equipe: valor(row, iEquipe) || undefined,
      responsavel: valor(row, iResponsavel) || undefined,
      cnpj: valor(row, iCnpj) || undefined,
      faixaDivida: valor(row, iFaixaDivida) || undefined,
      situacaoDivida: valor(row, iSituacaoDivida) || undefined,
      meiosContato: valor(row, iMeiosContato) || undefined,
      campanhaCriativo: valor(row, iCampanha) || undefined,
      dataEntrada: valor(row, iDataEntrada) || undefined,
      observacao: valor(row, iObservacao) || undefined
    };

    try {
      const r = await sincronizarLeadDfline(payload);
      if (r.duplicado) resultado.duplicados++;
      else resultado.sincronizados++;
    } catch (erro: any) {
      resultado.erros.push({ linha: linha + 1, erro: erro.message });
    }
  }

  return resultado;
}

/**
 * Aba "PRODUTOR RURAL" — sem etapa de ChatGuru (nenhuma automação registra essa
 * aba hoje), então qualquer linha com telefone é candidata; a deduplicação por
 * LeadDflineImportado.telefoneNormalizado garante que não reprocessa.
 */
export async function processarRural(valores: string[][]): Promise<ResultadoPollingAba> {
  const resultado: ResultadoPollingAba = { linhasVistas: 0, candidatos: 0, sincronizados: 0, duplicados: 0, erros: [] };
  if (!valores.length) return resultado;

  const indices = mapearCabecalho(valores[0]);
  const iContato = acharColuna(indices, ["nome"]);
  const iTelefone = acharColuna(indices, ["telefone"]);
  const iEmpresa = acharColuna(indices, ["nome da empresa"]);
  const iEquipe = acharColuna(indices, [], ["equipe"]);
  const iResponsavel = acharColuna(indices, ["responsavel"]);
  const iEmail = acharColuna(indices, ["e-mail", "email"]);
  const iCampanha = acharColuna(indices, ["campanha"]);
  const iValorDivida = acharColuna(indices, [], ["endividamento"]);
  const iOrigemDivida = acharColuna(indices, [], ["origem dessa divida", "origem dessa dívida"]);
  const iSituacaoCobranca = acharColuna(indices, [], ["situacao atual de cobranca", "situação atual de cobrança"]);

  for (let linha = 1; linha < valores.length; linha++) {
    const row = valores[linha];
    if (!row || !row.length) continue;
    resultado.linhasVistas++;

    const telefone = valor(row, iTelefone);
    if (!telefone) continue;
    resultado.candidatos++;

    const payload: PayloadSincronizacaoDfline = {
      origemAba: "PRODUTOR_RURAL",
      contato: valor(row, iContato) || "Sem nome",
      empresa: valor(row, iEmpresa) || undefined,
      telefone,
      email: valor(row, iEmail) || undefined,
      equipe: valor(row, iEquipe) || undefined,
      responsavel: valor(row, iResponsavel) || undefined,
      faixaDivida: valor(row, iValorDivida) || undefined,
      situacaoDivida: valor(row, iSituacaoCobranca) || undefined,
      campanhaCriativo: valor(row, iCampanha) || undefined,
      observacao: valor(row, iOrigemDivida) ? `Origem da dívida: ${valor(row, iOrigemDivida)}` : undefined
    };

    try {
      const r = await sincronizarLeadDfline(payload);
      if (r.duplicado) resultado.duplicados++;
      else resultado.sincronizados++;
    } catch (erro: any) {
      resultado.erros.push({ linha: linha + 1, erro: erro.message });
    }
  }

  return resultado;
}

/**
 * Aba "Formulário por Faturamento" — mesmo padrão da PRODUTOR RURAL (sem etapa
 * de ChatGuru própria conhecida, qualquer linha com telefone é candidata).
 * Cabeçalho em formato "snake_case_com_pontuação_no_meio" — normalizar() já lida
 * com isso substituindo "_"/"?"/":" por espaço antes de comparar.
 */
/**
 * Aba única "Consolidado Único" — substitui a leitura separada das três abas
 * antigas depois que o espelho automático (sheetsUnificacao.ts) e o cadastro no
 * ChatGuru passaram a operar só nela. Mesmo gate da Consolidado original: só
 * sincroniza depois que o ChatGuru já processou a linha.
 */
export async function processarConsolidadoUnico(valores: string[][]): Promise<ResultadoPollingAba> {
  const resultado: ResultadoPollingAba = { linhasVistas: 0, candidatos: 0, sincronizados: 0, duplicados: 0, erros: [] };
  if (!valores.length) return resultado;

  const indices = mapearCabecalho(valores[0]);
  const iOrigem = acharColuna(indices, ["origem"]);
  const iData = acharColuna(indices, ["data"]);
  const iCampanha = acharColuna(indices, ["campanha criativo"]);
  const iEmail = acharColuna(indices, ["email"]);
  const iContato = acharColuna(indices, ["nome"]);
  const iTelefone = acharColuna(indices, ["telefone"]);
  const iEmpresa = acharColuna(indices, ["empresa"]);
  const iFaixaDivida = acharColuna(indices, ["faixa divida"]);
  const iSituacaoDivida = acharColuna(indices, ["situacao divida"]);
  const iOrigemDivida = acharColuna(indices, ["origem divida"]);
  const iPorteFaturamento = acharColuna(indices, ["porte faturamento"]);
  const iMeiosContato = acharColuna(indices, ["meios contato"]);
  const iCnpj = acharColuna(indices, [], ["cnpj"]);
  const iEquipe = acharColuna(indices, ["equipe planilha"]);
  const iResponsavel = acharColuna(indices, ["responsavel"]);
  const iStatusChat = acharColuna(indices, [], ["adcionado ao chat", "adicionado ao chat"]);
  const iObservacao = acharColuna(indices, [], ["observacao", "observação"]);

  const origemPorTexto: Record<string, PayloadSincronizacaoDfline["origemAba"]> = {
    consolidado: "CONSOLIDADO_2_1_5",
    rural: "PRODUTOR_RURAL",
    faturamento: "FORMULARIO_FATURAMENTO"
  };

  for (let i = 1; i < valores.length; i++) {
    const row = valores[i];
    if (!row || !row.length) continue;
    resultado.linhasVistas++;

    const statusChat = normalizar(valor(row, iStatusChat));
    if (!statusChat.includes("cadastrado chatguru")) continue; // normalizar() troca "_" por espaço — só sincroniza depois do ChatGuru concluído
    const telefone = valor(row, iTelefone);
    if (!telefone) continue;
    resultado.candidatos++;

    const origemAba = origemPorTexto[normalizar(valor(row, iOrigem))] || "CONSOLIDADO_2_1_5";
    const observacaoPartes = [
      valor(row, iOrigemDivida) ? `Origem da dívida: ${valor(row, iOrigemDivida)}` : null,
      valor(row, iPorteFaturamento) || null,
      valor(row, iObservacao) || null
    ].filter(Boolean);

    const payload: PayloadSincronizacaoDfline = {
      origemAba,
      contato: valor(row, iContato) || "Sem nome",
      empresa: valor(row, iEmpresa) || undefined,
      telefone,
      email: valor(row, iEmail) || undefined,
      equipe: valor(row, iEquipe) || undefined,
      responsavel: valor(row, iResponsavel) || undefined,
      cnpj: valor(row, iCnpj) || undefined,
      faixaDivida: valor(row, iFaixaDivida) || undefined,
      situacaoDivida: valor(row, iSituacaoDivida) || undefined,
      meiosContato: valor(row, iMeiosContato) || undefined,
      campanhaCriativo: valor(row, iCampanha) || undefined,
      dataEntrada: valor(row, iData) || undefined,
      observacao: observacaoPartes.length ? observacaoPartes.join(" | ") : undefined
    };

    try {
      const r = await sincronizarLeadDfline(payload);
      if (r.duplicado) resultado.duplicados++;
      else resultado.sincronizados++;
    } catch (erro: any) {
      resultado.erros.push({ linha: i + 1, erro: erro.message });
    }
  }

  return resultado;
}

export async function processarFaturamento(valores: string[][]): Promise<ResultadoPollingAba> {
  const resultado: ResultadoPollingAba = { linhasVistas: 0, candidatos: 0, sincronizados: 0, duplicados: 0, erros: [] };
  if (!valores.length) return resultado;

  const indices = mapearCabecalho(valores[0]);
  const iContato = acharColuna(indices, [], ["nome completo", "nome"]);
  const iTelefone = acharColuna(indices, ["telefone"]);
  const iEmpresa = acharColuna(indices, [], ["nome da empresa"]);
  const iEquipe = acharColuna(indices, [], ["equipe"]);
  const iResponsavel = acharColuna(indices, ["responsavel"]);
  const iEmail = acharColuna(indices, ["e-mail", "email"]);
  const iCampanha = acharColuna(indices, [], ["campaign", "campanha"]);
  const iFaixaDivida = acharColuna(indices, [], ["divida e"]);
  const iSituacaoDivida = acharColuna(indices, [], ["situacao da divida"]);
  const iMeiosContato = acharColuna(indices, [], ["meios de contato"]);
  const iPorte = acharColuna(indices, [], ["porte da sua empresa"]);
  const iFaturamento = acharColuna(indices, [], ["faturamento medio mensal"]);

  for (let linha = 1; linha < valores.length; linha++) {
    const row = valores[linha];
    if (!row || !row.length) continue;
    resultado.linhasVistas++;

    const telefone = valor(row, iTelefone);
    if (!telefone) continue;
    resultado.candidatos++;

    const observacaoPartes = [
      valor(row, iPorte) ? `Porte da empresa: ${valor(row, iPorte)}` : null,
      valor(row, iFaturamento) ? `Faturamento médio mensal: ${valor(row, iFaturamento)}` : null
    ].filter(Boolean);

    const payload: PayloadSincronizacaoDfline = {
      origemAba: "FORMULARIO_FATURAMENTO",
      contato: valor(row, iContato) || "Sem nome",
      empresa: valor(row, iEmpresa) || undefined,
      telefone,
      email: valor(row, iEmail) || undefined,
      equipe: valor(row, iEquipe) || undefined,
      responsavel: valor(row, iResponsavel) || undefined,
      faixaDivida: valor(row, iFaixaDivida) || undefined,
      situacaoDivida: valor(row, iSituacaoDivida) || undefined,
      meiosContato: valor(row, iMeiosContato) || undefined,
      campanhaCriativo: valor(row, iCampanha) || undefined,
      observacao: observacaoPartes.length ? observacaoPartes.join(" | ") : undefined
    };

    try {
      const r = await sincronizarLeadDfline(payload);
      if (r.duplicado) resultado.duplicados++;
      else resultado.sincronizados++;
    } catch (erro: any) {
      resultado.erros.push({ linha: linha + 1, erro: erro.message });
    }
  }

  return resultado;
}
