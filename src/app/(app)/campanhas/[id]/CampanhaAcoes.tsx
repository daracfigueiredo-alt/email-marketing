"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CampanhaAcoes({ id, statusAtual }: { id: string; statusAtual: string }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function alterarStatus(status: string) {
    setCarregando(true);
    await fetch(`/api/campanhas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    setCarregando(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {statusAtual !== "PAUSADA" && (
        <button disabled={carregando} onClick={() => alterarStatus("PAUSADA")} className="text-sm border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50">
          Pausar
        </button>
      )}
      {statusAtual !== "ATIVA" && (
        <button disabled={carregando} onClick={() => alterarStatus("ATIVA")} className="text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5">
          Ativar
        </button>
      )}
    </div>
  );
}
