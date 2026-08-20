import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import { prisma } from "@/lib/prisma";
import CampanhaAcoes from "./CampanhaAcoes";

export default async function CampanhaDetalhePage({ params }: { params: { id: string } }) {
  const campanha = await prisma.campanha.findUnique({
    where: { id: params.id },
    include: {
      etapas: { orderBy: { ordem: "asc" }, include: { modelo: true } },
      leads: { take: 50, orderBy: { criadoEm: "desc" } },
      _count: { select: { leads: true } }
    }
  });
  if (!campanha) notFound();

  const [enviados, entregues, falhas] = await Promise.all([
    prisma.mensagem.count({ where: { direcao: "ENVIADA", status: { in: ["ENVIADO", "ENTREGUE"] }, lead: { campanhaId: campanha.id } } }),
    prisma.mensagem.count({ where: { direcao: "ENVIADA", status: "ENTREGUE", lead: { campanhaId: campanha.id } } }),
    prisma.mensagem.count({ where: { direcao: "ENVIADA", status: "FALHOU", lead: { campanhaId: campanha.id } } })
  ]);
  const respostas = campanha.leads.filter((l) => l.ultimaResposta).length;
  const optOuts = campanha.leads.filter((l) => l.optOut).length;
  const taxaResposta = campanha.leads.length > 0 ? `${((respostas / campanha.leads.length) * 100).toFixed(1)}%` : "0%";

  return (
    <div>
      <PageHeader
        titulo={campanha.nome}
        descricao={campanha.descricao ?? undefined}
        acao={
          <div className="flex items-center gap-2">
            <Link href={`/campanhas/${campanha.id}/editar`} className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded px-3 py-1.5">
              Editar
            </Link>
            <a href={`/api/campanhas/${campanha.id}/exportar?formato=pdf`} className="text-xs border border-slate-300 rounded px-2 py-1.5 hover:bg-slate-50">
              PDF
            </a>
            <a href={`/api/campanhas/${campanha.id}/exportar?formato=xlsx`} className="text-xs border border-slate-300 rounded px-2 py-1.5 hover:bg-slate-50">
              Excel
            </a>
            <a href={`/api/campanhas/${campanha.id}/exportar?formato=csv`} className="text-xs border border-slate-300 rounded px-2 py-1.5 hover:bg-slate-50">
              CSV
            </a>
            <CampanhaAcoes id={campanha.id} statusAtual={campanha.status} />
          </div>
        }
      />

      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Desempenho</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <StatCard label="Total de leads" value={campanha.leads.length} />
          <StatCard label="Enviados" value={enviados} />
          <StatCard label="Entregues" value={entregues} />
          <StatCard label="Falhas" value={falhas} />
          <StatCard label="Taxa de resposta" value={taxaResposta} />
          <StatCard label="Opt-outs" value={optOuts} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Sequência ({campanha.etapas.length} etapas)</h2>
          <ol className="space-y-2 text-sm">
            {campanha.etapas.map((etapa) => (
              <li key={etapa.id} className="border border-slate-200 rounded-md p-2">
                <p className="font-medium text-slate-700">Etapa {etapa.ordem + 1}: {etapa.modelo.nome}</p>
                <p className="text-xs text-slate-400">{etapa.diasAposAnterior} dias após a etapa anterior</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="md:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Leads nesta campanha ({campanha._count.leads})</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left py-1">Nome</th>
                <th className="text-left py-1">Status</th>
                <th className="text-left py-1">Etapa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campanha.leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="py-2">{lead.nome}</td>
                  <td className="py-2">{lead.status}</td>
                  <td className="py-2">{lead.etapaAtual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
