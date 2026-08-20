"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";

const CAMPOS_SISTEMA = [
  { valor: "", rotulo: "Ignorar coluna" },
  { valor: "nome", rotulo: "Nome" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "empresa", rotulo: "Empresa" },
  { valor: "documento", rotulo: "CPF/CNPJ" },
  { valor: "observacao", rotulo: "Observação" }
];

type Etapa = "upload" | "mapeamento" | "previsualizacao";

export default function ImportarLeadsPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [colunas, setColunas] = useState<string[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, string | null>>({});
  const [resumo, setResumo] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setCarregando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const resp = await fetch("/api/leads/import/preview", { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Falha ao ler a planilha");
      const dados = await resp.json();
      setColunas(dados.colunas);
      setMapeamento(dados.mapeamentoSugerido);
      setEtapa("mapeamento");
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleValidar() {
    if (!arquivo) return;
    setCarregando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("mapeamento", JSON.stringify(mapeamento));
      const resp = await fetch("/api/leads/import/validar", { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Falha ao validar planilha");
      const dados = await resp.json();
      setResumo(dados.resumo);
      setEtapa("previsualizacao");
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleConfirmarImportacao() {
    if (!arquivo) return;
    setCarregando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("mapeamento", JSON.stringify(mapeamento));
      const resp = await fetch("/api/leads/import/confirm", { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Falha ao importar");
      router.push("/leads");
      router.refresh();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <PageHeader titulo="Importar planilha" descricao="XLSX ou CSV — nome, e-mail e telefone são identificados automaticamente" />

      {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

      {etapa === "upload" && (
        <Card className="max-w-lg">
          <form onSubmit={handleUpload} className="space-y-4">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
              required
            />
            <button
              type="submit"
              disabled={carregando || !arquivo}
              className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-60"
            >
              {carregando ? "Lendo arquivo..." : "Continuar"}
            </button>
          </form>
        </Card>
      )}

      {etapa === "mapeamento" && (
        <Card className="max-w-2xl">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Confirme o mapeamento de colunas</h2>
          <table className="w-full text-sm mb-4">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left py-1">Coluna da planilha</th>
                <th className="text-left py-1">Campo do sistema</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {colunas.map((coluna) => (
                <tr key={coluna}>
                  <td className="py-2 pr-4">{coluna}</td>
                  <td className="py-2">
                    <select
                      className="border border-slate-300 rounded-md px-2 py-1 text-sm"
                      value={mapeamento[coluna] ?? ""}
                      onChange={(e) => setMapeamento({ ...mapeamento, [coluna]: e.target.value || null })}
                    >
                      {CAMPOS_SISTEMA.map((c) => (
                        <option key={c.valor} value={c.valor}>
                          {c.rotulo}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={handleValidar}
            disabled={carregando}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-60"
          >
            {carregando ? "Validando..." : "Pré-visualizar"}
          </button>
        </Card>
      )}

      {etapa === "previsualizacao" && resumo && (
        <Card className="max-w-2xl">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Pré-visualização</h2>
          <div className="grid grid-cols-3 gap-3 mb-6 text-sm">
            <ResumoItem label="Total de linhas" valor={resumo.totalLinhas} />
            <ResumoItem label="Leads válidos" valor={resumo.leadsValidos} destaque />
            <ResumoItem label="Sem e-mail/telefone" valor={resumo.leadsSemEmail} />
            <ResumoItem label="E-mails inválidos" valor={resumo.emailsInvalidos} />
            <ResumoItem label="Telefones inválidos" valor={resumo.telefonesInvalidos} />
            <ResumoItem label="Duplicados na planilha" valor={resumo.duplicados} />
            <ResumoItem label="Já existentes no sistema" valor={resumo.jaExistentes} />
          </div>
          <button
            onClick={handleConfirmarImportacao}
            disabled={carregando || resumo.leadsValidos === 0}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-60"
          >
            {carregando ? "Importando..." : "CONFIRMAR IMPORTAÇÃO"}
          </button>
        </Card>
      )}
    </div>
  );
}

function ResumoItem({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-md p-3 ${destaque ? "bg-green-50 text-green-800" : "bg-slate-50 text-slate-700"}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-semibold">{valor}</p>
    </div>
  );
}
