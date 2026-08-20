"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ModeloActions({ id }: { id: string }) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    if (!confirm("Excluir este modelo? Essa ação não pode ser desfeita.")) return;
    setExcluindo(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/modelos/${id}`, { method: "DELETE" });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(dados.erro || "Falha ao excluir");
      router.refresh();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="flex items-center gap-3 mt-2">
      <a href={`/modelos/${id}`} className="text-xs text-brand-600 hover:underline">
        Editar
      </a>
      <button disabled={excluindo} onClick={excluir} className="text-xs text-red-600 hover:underline disabled:opacity-60">
        {excluindo ? "Excluindo..." : "Excluir"}
      </button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
