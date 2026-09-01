/**
 * Migração histórica: transforma linhas das três abas antigas (consolidado 2.1.5,
 * PRODUTOR RURAL, Formulário por Faturamento) para o layout único da aba
 * "Consolidado Único" (16 colunas fixas, ver header em migrar-unico/route.ts).
 *
 * Preserva equipe/responsável/status exatamente como já estavam — não há nenhuma
 * lógica de redistribuição aqui, só remapeamento de coluna (pedido do usuário:
 * "só preservar o que já existe").
 */
import { mapearCabecalho, acharColuna, valor } from "./sheetsPolling";

export type OrigemUnificacao = "CONSOLIDADO" | "RURAL" | "FATURAMENTO";

/**
 * Colunas I–U (adicionadas a pedido do usuário: "vamos portar toda planilha",
 * posicionadas entre Faixa_Divida e CNPJ a pedido do usuário) — réplica literal
 * das perguntas originais de cada aba fonte, cada uma na sua própria coluna, além
 * (não em troca) das colunas genéricas que já existiam. Várias dessas perguntas já
 * eram lidas pra preencher as colunas genéricas — aqui só reaproveita o mesmo valor
 * extraído, sem reprocessar nada.
 *
 * Isso empurra situacaoDivida/origemDivida/porteFaturamento/meiosContato/cnpj/
 * equipe/responsavel/adcionadoAoChat/statusLead/observacao 13 posições pra frente
 * (de I–R pra V–AE). O cenário Make "1 - Cadastro ChatGuru", que escreve
 * responsável/status por índice numérico fixo, TEM que ser atualizado pras novas
 * posições (27 e 28) junto com essa mudança — combinar os dois é obrigatório,
 * senão ele volta a escrever nas colunas erradas (foi isso que quebrou mais cedo).
 */
function linhaUnificada(partes: {
  origem: OrigemUnificacao;
  nome: string;
  telefone: string;
  email: string;
  empresa: string;
  equipe: string;
  responsavel: string;
  cnpj: string;
  faixaDivida: string;
  situacaoDivida: string;
  origemDivida: string;
  porteFaturamento: string;
  meiosContato: string;
  campanha: string;
  dataEntrada: string;
  observacao: string;
  adcionadoAoChat: string;
  statusLead: string;
  valorDividaBancariaEmpresa?: string;
  situacaoDividaOriginal?: string;
  meiosContatoOriginal?: string;
  porteEmpresa?: string;
  naturezaJuridica?: string;
  faturamentoMedioMensal?: string;
  contratosBancariosMensal?: string;
  atuacaoRural?: string;
  endividamentoRural?: string;
  origemDividaRural?: string;
  situacaoCobrancaRural?: string;
  valorDividaConsolidado?: string;
  dividaCnpjOuCpf?: string;
}): string[] {
  return [
    partes.origem,
    partes.dataEntrada,
    partes.campanha,
    partes.email,
    partes.nome,
    partes.telefone,
    partes.empresa,
    partes.faixaDivida,
    partes.valorDividaBancariaEmpresa ?? "",
    partes.situacaoDividaOriginal ?? "",
    partes.meiosContatoOriginal ?? "",
    partes.porteEmpresa ?? "",
    partes.naturezaJuridica ?? "",
    partes.faturamentoMedioMensal ?? "",
    partes.contratosBancariosMensal ?? "",
    partes.atuacaoRural ?? "",
    partes.endividamentoRural ?? "",
    partes.origemDividaRural ?? "",
    partes.situacaoCobrancaRural ?? "",
    partes.valorDividaConsolidado ?? "",
    partes.dividaCnpjOuCpf ?? "",
    partes.situacaoDivida,
    partes.origemDivida,
    partes.porteFaturamento,
    partes.meiosContato,
    partes.cnpj,
    partes.equipe,
    partes.responsavel,
    partes.adcionadoAoChat,
    partes.statusLead,
    partes.observacao
  ];
}

export function unificarConsolidado(valores: string[][]): string[][] {
  if (!valores.length) return [];
  const indices = mapearCabecalho(valores[0]);
  const iContato = acharColuna(indices, ["nome do responsavel"]);
  const iTelefone = acharColuna(indices, ["telefone"]);
  const iEmpresa = acharColuna(indices, ["nome da empresa"]);
  const iEquipe = acharColuna(indices, [], ["equipe"]);
  const iResponsavel = acharColuna(indices, ["responsavel"]);
  const iEmail = acharColuna(indices, ["e-mail", "email"]);
  const iCnpj = acharColuna(indices, [], ["cnpj"]);
  const iFaixaDivida = acharColuna(indices, [], ["sua divida e"]);
  const iSituacaoDivida = acharColuna(indices, [], ["situacao da divida", "situação da dívida"]);
  const iMeiosContato = acharColuna(indices, ["meios de contato"]);
  const iCampanha = acharColuna(indices, [], ["campanha"]);
  const iDataEntrada = acharColuna(indices, ["data de entrada"]);
  const iObservacao = acharColuna(indices, [], ["observacao", "observação"]);
  const iStatusChat = acharColuna(indices, [], ["adcionado ao chat", "adicionado ao chat"]);
  const iStatusLead = acharColuna(indices, ["status do lead"]);
  const iCnpjOuCpf = acharColuna(indices, [], ["divida e no cnpj ou cpf"]);

  const linhas: string[][] = [];
  for (let i = 1; i < valores.length; i++) {
    const row = valores[i];
    if (!row || !row.length) continue;
    const telefone = valor(row, iTelefone);
    if (!telefone) continue;
    linhas.push(
      linhaUnificada({
        origem: "CONSOLIDADO",
        nome: valor(row, iContato),
        telefone,
        email: valor(row, iEmail),
        empresa: valor(row, iEmpresa),
        equipe: valor(row, iEquipe),
        responsavel: valor(row, iResponsavel),
        cnpj: valor(row, iCnpj),
        faixaDivida: valor(row, iFaixaDivida),
        situacaoDivida: valor(row, iSituacaoDivida),
        origemDivida: "",
        porteFaturamento: "",
        meiosContato: valor(row, iMeiosContato),
        campanha: valor(row, iCampanha),
        dataEntrada: valor(row, iDataEntrada),
        observacao: valor(row, iObservacao),
        adcionadoAoChat: valor(row, iStatusChat),
        statusLead: valor(row, iStatusLead),
        situacaoDividaOriginal: valor(row, iSituacaoDivida),
        meiosContatoOriginal: valor(row, iMeiosContato),
        valorDividaConsolidado: valor(row, iFaixaDivida),
        dividaCnpjOuCpf: valor(row, iCnpjOuCpf)
      })
    );
  }
  return linhas;
}

export function unificarRural(valores: string[][]): string[][] {
  if (!valores.length) return [];
  const indices = mapearCabecalho(valores[0]);
  const iContato = acharColuna(indices, ["nome"]);
  const iTelefone = acharColuna(indices, ["telefone"]);
  const iEmpresa = acharColuna(indices, ["nome da empresa"]);
  const iEquipe = acharColuna(indices, [], ["equipe"]);
  const iResponsavel = acharColuna(indices, ["responsavel"]);
  const iEmail = acharColuna(indices, ["e-mail", "email"]);
  const iCampanha = 3; // coluna D (Anúncio) — pedido do usuário
  const iValorDivida = acharColuna(indices, [], ["endividamento"]);
  const iOrigemDivida = acharColuna(indices, [], ["origem dessa divida", "origem dessa dívida"]);
  const iSituacaoCobranca = acharColuna(indices, [], ["situacao atual de cobranca", "situação atual de cobrança"]);
  const iStatusChat = acharColuna(indices, [], ["adcionado ao chat", "adicionado ao chat"]);
  const iStatusLead = acharColuna(indices, ["status do lead"]);
  const iAtuacaoRural = acharColuna(indices, [], ["atuacao no meio rural"]);

  const linhas: string[][] = [];
  for (let i = 1; i < valores.length; i++) {
    const row = valores[i];
    if (!row || !row.length) continue;
    const telefone = valor(row, iTelefone);
    if (!telefone) continue;
    linhas.push(
      linhaUnificada({
        origem: "RURAL",
        nome: valor(row, iContato),
        telefone,
        email: valor(row, iEmail),
        empresa: valor(row, iEmpresa),
        equipe: valor(row, iEquipe),
        responsavel: valor(row, iResponsavel),
        cnpj: "",
        faixaDivida: valor(row, iValorDivida),
        situacaoDivida: valor(row, iSituacaoCobranca),
        origemDivida: valor(row, iOrigemDivida),
        porteFaturamento: "",
        meiosContato: "",
        campanha: valor(row, iCampanha),
        dataEntrada: "",
        observacao: "",
        adcionadoAoChat: valor(row, iStatusChat),
        statusLead: valor(row, iStatusLead),
        atuacaoRural: valor(row, iAtuacaoRural),
        endividamentoRural: valor(row, iValorDivida),
        origemDividaRural: valor(row, iOrigemDivida),
        situacaoCobrancaRural: valor(row, iSituacaoCobranca)
      })
    );
  }
  return linhas;
}

export function unificarFaturamento(valores: string[][]): string[][] {
  if (!valores.length) return [];
  const indices = mapearCabecalho(valores[0]);
  const iContato = acharColuna(indices, [], ["nome completo", "nome"]);
  const iTelefone = acharColuna(indices, ["telefone"]);
  const iEmpresa = acharColuna(indices, [], ["nome da empresa"]);
  const iEquipe = acharColuna(indices, [], ["equipe"]);
  const iResponsavel = acharColuna(indices, ["responsavel"]);
  const iEmail = acharColuna(indices, ["e-mail", "email"]);
  const iCampanha = 4; // coluna E (ad_name) — pedido do usuário
  const iFaixaDivida = acharColuna(indices, [], ["divida e"]);
  const iSituacaoDivida = acharColuna(indices, [], ["situacao da divida"]);
  const iMeiosContato = acharColuna(indices, [], ["meios de contato"]);
  const iPorte = acharColuna(indices, [], ["porte da sua empresa"]);
  const iFaturamento = acharColuna(indices, [], ["faturamento medio mensal"]);
  const iData = acharColuna(indices, ["data"]);
  const iStatusChat = acharColuna(indices, [], ["adcionado ao chat", "adicionado ao chat"]);
  const iStatusLead = acharColuna(indices, ["status do lead"]);
  const iNaturezaJuridica = acharColuna(indices, [], ["natureza juridica da sua empresa"]);
  const iContratosBancarios = acharColuna(indices, [], ["paga por mes em contratos bancarios"]);

  const linhas: string[][] = [];
  for (let i = 1; i < valores.length; i++) {
    const row = valores[i];
    if (!row || !row.length) continue;
    const telefone = valor(row, iTelefone);
    if (!telefone) continue;

    const porteFaturamentoPartes = [
      valor(row, iPorte) ? `Porte da empresa: ${valor(row, iPorte)}` : null,
      valor(row, iFaturamento) ? `Faturamento médio mensal: ${valor(row, iFaturamento)}` : null
    ].filter(Boolean);

    linhas.push(
      linhaUnificada({
        origem: "FATURAMENTO",
        nome: valor(row, iContato),
        telefone,
        email: valor(row, iEmail),
        empresa: valor(row, iEmpresa),
        equipe: valor(row, iEquipe),
        responsavel: valor(row, iResponsavel),
        cnpj: "",
        faixaDivida: valor(row, iFaixaDivida),
        situacaoDivida: valor(row, iSituacaoDivida),
        origemDivida: "",
        porteFaturamento: porteFaturamentoPartes.join(" | "),
        meiosContato: valor(row, iMeiosContato),
        campanha: valor(row, iCampanha),
        dataEntrada: valor(row, iData),
        observacao: "",
        adcionadoAoChat: valor(row, iStatusChat),
        statusLead: valor(row, iStatusLead),
        valorDividaBancariaEmpresa: valor(row, iFaixaDivida),
        situacaoDividaOriginal: valor(row, iSituacaoDivida),
        meiosContatoOriginal: valor(row, iMeiosContato),
        porteEmpresa: valor(row, iPorte),
        naturezaJuridica: valor(row, iNaturezaJuridica),
        faturamentoMedioMensal: valor(row, iFaturamento),
        contratosBancariosMensal: valor(row, iContratosBancarios)
      })
    );
  }
  return linhas;
}
