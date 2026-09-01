import { get } from "@vercel/blob";

export interface AnexoInfo {
  nome: string;
  url?: string;
  tipo?: string;
  tamanho?: number;
}

export interface AnexoComConteudo {
  nome: string;
  tipo: string;
  base64: string;
}

/**
 * Lê do Vercel Blob (privado) o conteúdo de anexos já enviados via POST /api/anexos
 * (a URL segue o padrão /api/anexos/<uuid>__<nome-original>, que é também o pathname
 * no Blob) e devolve pronto para anexar de verdade no e-mail (Gmail/Outlook). Anexos
 * sem `url` são ignorados silenciosamente.
 */
export async function lerAnexosParaEnvio(anexos: AnexoInfo[] | null | undefined): Promise<AnexoComConteudo[]> {
  if (!anexos || anexos.length === 0) return [];

  const resultados: AnexoComConteudo[] = [];
  for (const anexo of anexos) {
    if (!anexo.url) continue;
    const pathnameNoBlob = anexo.url.split("/").pop();
    if (!pathnameNoBlob) continue;

    try {
      const resultado = await get(pathnameNoBlob, { access: "private" });
      if (!resultado?.stream) continue;

      const chunks: Uint8Array[] = [];
      for await (const chunk of resultado.stream as any) chunks.push(chunk);
      const conteudo = Buffer.concat(chunks);

      resultados.push({
        nome: anexo.nome,
        tipo: anexo.tipo || resultado.blob.contentType || "application/octet-stream",
        base64: conteudo.toString("base64")
      });
    } catch {
      // anexo não encontrado no Blob — segue sem ele em vez de falhar o envio inteiro
    }
  }
  return resultados;
}
