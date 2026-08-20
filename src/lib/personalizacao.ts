/**
 * Escapa caracteres especiais de HTML — os dados do lead (nome, empresa etc.)
 * podem vir de uma planilha importada, então nunca são confiáveis. Sem isso,
 * um nome de lead malicioso (ex: "<img onerror=...>") viraria HTML/JS ativo
 * dentro do e-mail e, mais grave, dentro da nossa própria Caixa de Entrada
 * quando o texto salvo é renderizado como HTML lá.
 */
function escaparHtml(valor: string) {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Substitui placeholders {{nome}}, {{empresa}} etc. pelo dado real do lead.
 * Usado ao montar o assunto/corpo de um Modelo de E-mail para um lead específico.
 */
export function personalizarTexto(
  texto: string,
  dados: { nome?: string | null; empresa?: string | null; email?: string | null; telefone?: string | null; responsavel?: string | null }
) {
  const nomePrimeiro = dados.nome?.split(" ")[0] || dados.nome || "";
  return texto
    .replaceAll("{{nome}}", escaparHtml(nomePrimeiro))
    .replaceAll("{{nome_completo}}", escaparHtml(dados.nome || ""))
    .replaceAll("{{empresa}}", escaparHtml(dados.empresa || ""))
    .replaceAll("{{email}}", escaparHtml(dados.email || ""))
    .replaceAll("{{telefone}}", escaparHtml(dados.telefone || ""))
    .replaceAll("{{responsavel}}", escaparHtml(dados.responsavel || ""));
}
