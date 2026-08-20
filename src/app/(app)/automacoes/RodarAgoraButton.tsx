"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RodarAgoraButton() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function rodar() {
    setCarregando(true);
    await fetch("/api/automacoes/run", { method: "POST" });
    setCarregando(false);
    router.refresh();
  }

  return (
    <button onClick={rodar} disabled={carregando} className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-60">
      {carregando ? "Executando..." : "Rodar agora"}
    </button>
  );
}
