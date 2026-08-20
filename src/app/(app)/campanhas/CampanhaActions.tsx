"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CampanhaActions({ id }: { id: string }) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    if (!confirm("Excluir esta campanha? Essa ação não pode ser desfeita.")) return;
    setExcluindo(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/campanhas/${id}`, { method: "DELETE" });
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
    <div className="mt-2">
      <button disabled={excluindo} onClick={excluir} className="text-xs text-red-600 hover:underline disabled:opacity-60">
        {excluindo ? "Excluindo..." : "Excluir"}
      </button>
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
    </div>
  );
}
