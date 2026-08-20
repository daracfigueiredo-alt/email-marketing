"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PerfilForm({ nomeAtual }: { nomeAtual: string }) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeAtual);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    setMensagem(null);
    try {
      const resp = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, senhaAtual: senhaAtual || undefined, novaSenha: novaSenha || undefined })
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || "Falha ao salvar");
      setMensagem("Perfil atualizado.");
      setSenhaAtual("");
      setNovaSenha("");
      router.refresh();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
        <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Senha atual</label>
        <input type="password" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nova senha</label>
        <input type="password" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} minLength={6} />
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {mensagem && <p className="text-sm text-green-600">{mensagem}</p>}
      <button disabled={carregando} className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-60">
        {carregando ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
