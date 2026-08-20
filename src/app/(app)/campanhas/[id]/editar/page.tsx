"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";

interface Modelo {
  id: string;
  nome: string;
}

interface ContaEmail {
  id: string;
  emailConta: string;
  nomeRemetente: string;
}

interface Usuario {
  id: string;
  nome: string;
}

interface Etapa {
  modeloId: string;
  diasAposAnterior: number;
}

export default function EditarCampanhaPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [contas, setContas] = useState<ContaEmail[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [intervaloDias, setIntervaloDias] = useState(3);
  const [contaEmailId, setContaEmailId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [horarioEnvio, setHorarioEnvio] = useState("09:00");
  const [etapas, setEtapas] = useState<Etapa[]>([{ modeloId: "", diasAposAnterior: 3 }]);
  const [carregando, setCarregando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/modelos").then((r) => r.json()).then(setModelos);
    fetch("/api/contas-email").then((r) => r.json()).then(setContas);
    fetch("/api/usuarios").then((r) => r.json()).then(setUsuarios);
    fetch(`/api/campanhas/${params.id}`)
      .then((r) => r.json())
      .then((c) => {
        setNome(c.nome);
        setDescricao(c.descricao || "");
        setIntervaloDias(c.intervaloDias);
        setContaEmailId(c.contaEmailId || "");
        setResponsavelId(c.responsavelId || "");
        setDataInicio(c.dataInicio ? c.dataInicio.slice(0, 10) : "");
        setHorarioEnvio(c.horarioEnvio || "09:00");
        setEtapas(
          c.etapas
            .sort((a: any, b: any) => a.ordem - b.ordem)
            .map((e: any) => ({ modeloId: e.modeloId, diasAposAnterior: e.diasAposAnterior }))
        );
      })
      .catch(() => setErro("Falha ao carregar campanha"))
      .finally(() => setCarregandoDados(false));
  }, [params.id]);

  function adicionarEtapa() {
    setEtapas([...etapas, { modeloId: "", diasAposAnterior: intervaloDias }]);
  }

  function removerEtapa(index: number) {
    setEtapas(etapas.filter((_, i) => i !== index));
  }

  function atualizarEtapa(index: number, campo: keyof Etapa, valor: string | number) {
    setEtapas(etapas.map((e, i) => (i === index ? { ...e, [campo]: valor } : e)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/campanhas/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          descricao,
          intervaloDias,
          contaEmailId: contaEmailId || undefined,
          responsavelId: responsavelId || undefined,
          dataInicio: dataInicio || undefined,
          horarioEnvio,
          etapas
        })
      });
      if (!resp.ok) throw new Error("Falha ao salvar campanha. Verifique se todas as etapas têm um modelo selecionado.");
      router.push(`/campanhas/${params.id}`);
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
      <PageHeader titulo="Editar Campanha" />
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da campanha</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Intervalo padrão de remarketing (dias)</label>
              <input
                type="number"
                min={1}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={intervaloDias}
                onChange={(e) => setIntervaloDias(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Responsável pela campanha</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
                <option value="">Eu mesmo</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enviar como (conta de e-mail)</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={contaEmailId} onChange={(e) => setContaEmailId(e.target.value)}>
                <option value="">Conta padrão do ambiente</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomeRemetente} ({c.emailConta})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de início</label>
                <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
                <input type="time" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={horarioEnvio} onChange={(e) => setHorarioEnvio(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-slate-700">Sequência de mensagens</label>
              <button type="button" onClick={adicionarEtapa} className="text-xs text-brand-600 hover:underline">
                + Adicionar etapa
              </button>
            </div>
            <div className="space-y-2">
              {etapas.map((etapa, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-md p-2">
                  <span className="text-xs text-slate-500 w-16">Etapa {i + 1}</span>
                  <select
                    className="flex-1 border border-slate-300 rounded-md px-2 py-1 text-sm"
                    value={etapa.modeloId}
                    onChange={(e) => atualizarEtapa(i, "modeloId", e.target.value)}
                    required
                  >
                    <option value="">Selecione o modelo...</option>
                    {modelos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
                    value={etapa.diasAposAnterior}
                    onChange={(e) => atualizarEtapa(i, "diasAposAnterior", Number(e.target.value))}
                    title="Dias após a etapa anterior"
                  />
                  <span className="text-xs text-slate-400">dias</span>
                  {etapas.length > 1 && (
                    <button type="button" onClick={() => removerEtapa(i)} className="text-xs text-red-500 hover:underline">
                      remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button disabled={carregando} className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-60">
              {carregando ? "Salvando..." : "Salvar alterações"}
            </button>
            <button type="button" onClick={() => router.push(`/campanhas/${params.id}`)} className="text-sm text-slate-500 hover:underline">
              Cancelar
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
