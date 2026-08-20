"use client";
import { useState } from "react";

export interface Anexo {
  nome: string;
  url?: string;
  tipo?: string;
  tamanho?: number;
}

/** Upload de anexo (qualquer tipo, inclusive vídeo) — reaproveitado em Modelos e na Caixa de Entrada. */
export default function AnexoUploader({ anexos, onChange, label }: { anexos: Anexo[]; onChange: (anexos: Anexo[]) => void; label?: string }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleAnexar(arquivo: File) {
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const resp = await fetch("/api/anexos", { method: "POST", body: fd });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || "Falha ao enviar anexo");
      onChange([...anexos, dados]);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <label className="text-xs text-slate-500">
        {label ?? "Anexar arquivo ou vídeo (PDF, DOCX, XLSX, JPG, PNG, MP4 e outros — até 15MB)"}
        <input
          type="file"
          disabled={enviando}
          className="block text-xs mt-1"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) handleAnexar(arquivo);
            e.target.value = "";
          }}
        />
      </label>
      {enviando && <p className="text-xs text-slate-400 mt-1">Enviando anexo...</p>}
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
      {anexos.length > 0 && (
        <ul className="text-xs text-slate-500 mt-2 space-y-1">
          {anexos.map((a, i) => (
            <li key={i} className="flex items-center gap-2">
              <span>
                📎 {a.nome} {a.tamanho ? `(${(a.tamanho / 1024 / 1024).toFixed(1)}MB)` : ""}
              </span>
              <button type="button" onClick={() => onChange(anexos.filter((_, idx) => idx !== i))} className="text-red-500 hover:underline">
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
