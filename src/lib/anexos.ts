import { readFile } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

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
 * Lê do disco o conteúdo de anexos já enviados via POST /api/anexos (a URL segue
 * o padrão /api/anexos/<uuid>__<nome-original>) e devolve pronto para anexar de
 * verdade no e-mail (Gmail/Outlook). Anexos sem `url` local (ex: vindos de fora)
 * são ignorados silenciosamente.
 */
export async function lerAnexosParaEnvio(anexos: AnexoInfo[] | null | undefined): Promise<AnexoComConteudo[]> {
  if (!anexos || anexos.length === 0) return [];

  const resultados: AnexoComConteudo[] = [];
  for (const anexo of anexos) {
    if (!anexo.url) continue;
    const nomeArquivoNoDisco = path.basename(anexo.url);
    const caminho = path.join(UPLOADS_DIR, nomeArquivoNoDisco);
    if (!caminho.startsWith(UPLOADS_DIR)) continue;

    try {
      const conteudo = await readFile(caminho);
      resultados.push({
        nome: anexo.nome,
        tipo: anexo.tipo || "application/octet-stream",
        base64: conteudo.toString("base64")
      });
    } catch {
      // anexo não encontrado no disco — segue sem ele em vez de falhar o envio inteiro
    }
  }
  return resultados;
}
