"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";

export default function NovoUsuarioPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nome: "", email: "", login: "", senha: "", perfil: "OPERADOR" });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!resp.ok) throw new Error("Falha ao criar usuário. Verifique se o e-mail/login já existem.");
      router.push("/usuarios");
      router.refresh();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <PageHeader titulo="Novo Usuário" />
      <Card className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input type="email" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Login</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha temporária</label>
            <input type="password" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Perfil</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}>
              <option value="ADMINISTRADOR">Administrador</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="OPERADOR">Operador/SDR</option>
            </select>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button disabled={carregando} className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-60">
            {carregando ? "Salvando..." : "Criar usuário"}
          </button>
        </form>
      </Card>
    </div>
  );
}
