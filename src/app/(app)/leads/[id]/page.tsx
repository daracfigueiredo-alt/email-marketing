import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";

export default async function LeadDetalhePage({ params }: { params: { id: string } }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      responsavel: true,
      campanha: true,
      mensagens: { orderBy: { criadoEm: "desc" } }
    }
  });
  if (!lead) notFound();

  return (
    <div>
      <PageHeader titulo={lead.nome} descricao={lead.email || lead.telefone || ""} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Dados do lead</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd>{lead.status}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Empresa</dt><dd>{lead.empresa || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Campanha</dt><dd>{lead.campanha?.nome || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Etapa remarketing</dt><dd>{lead.etapaAtual}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Próximo disparo</dt><dd>{lead.proximoDisparo ? new Date(lead.proximoDisparo).toLocaleDateString("pt-BR") : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Responsável</dt><dd>{lead.responsavel?.nome || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Status ChatGuru</dt><dd>{lead.chatguruStatus}</dd></div>
          </dl>
        </Card>

        <Card className="md:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Histórico de mensagens</h2>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {lead.mensagens.length === 0 && <p className="text-sm text-slate-400">Nenhuma mensagem trocada ainda.</p>}
            {lead.mensagens.map((m) => (
              <div key={m.id} className={`p-3 rounded-md text-sm ${m.direcao === "ENVIADA" ? "bg-brand-50" : "bg-slate-100"}`}>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{m.direcao === "ENVIADA" ? "Enviada" : "Recebida"} {m.assunto ? `· ${m.assunto}` : ""}</span>
                  <span>{new Date(m.criadoEm).toLocaleString("pt-BR")}</span>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap">{m.corpo}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
