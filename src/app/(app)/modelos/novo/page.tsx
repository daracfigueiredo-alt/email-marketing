"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import RichTextEditor from "@/components/RichTextEditor";
import AnexoUploader, { type Anexo } from "@/components/AnexoUploader";

export default function NovoModeloPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpoHtml, setCorpoHtml] = useState("Olá {{nome}}, tudo bem?\n\n");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, assunto, corpoHtml, anexos })
      });
      if (!resp.ok) throw new Error("Falha ao salvar modelo");
      router.push("/modelos");
      router.refresh();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <PageHeader titulo="Novo Modelo de E-mail" />
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do modelo</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assunto</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={assunto} onChange={(e) => setAssunto(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Corpo (use {"{{nome}}"} e {"{{empresa}}"} para personalizar)</label>
            <RichTextEditor value={corpoHtml} onChange={setCorpoHtml} rows={14} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Anexo (opcional)</label>
            <AnexoUploader anexos={anexos} onChange={setAnexos} />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button disabled={carregando} className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-60">
            {carregando ? "Salvando..." : "Salvar modelo"}
          </button>
        </form>
      </Card>
    </div>
  );
}
