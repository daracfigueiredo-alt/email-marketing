"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import RichTextEditor from "@/components/RichTextEditor";
import AnexoUploader, { type Anexo } from "@/components/AnexoUploader";

export default function EditarModeloPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpoHtml, setCorpoHtml] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/modelos/${params.id}`)
      .then((r) => r.json())
      .then((m) => {
        setNome(m.nome);
        setAssunto(m.assunto);
        setCorpoHtml(m.corpoHtml);
        setAnexos(m.anexos || []);
      })
      .catch(() => setErro("Falha ao carregar modelo"))
      .finally(() => setCarregandoDados(false));
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/modelos/${params.id}`, {
        method: "PUT",
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

  if (carregandoDados) return <p className="text-sm text-slate-400">Carregando...</p>;

  return (
    <div>
      <PageHeader titulo="Editar Modelo de E-mail" />
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
          <div className="flex gap-2">
            <button disabled={carregando} className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-60">
              {carregando ? "Salvando..." : "Salvar alterações"}
            </button>
            <button type="button" onClick={() => router.push("/modelos")} className="text-sm text-slate-500 hover:underline">
              Cancelar
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
