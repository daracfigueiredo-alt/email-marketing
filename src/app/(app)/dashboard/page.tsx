import PageHeader from "@/components/PageHeader";
import { StatCard, Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";

async function carregarEstatisticas() {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const [
    enviadosHoje,
    enviadosPeriodo,
    entregues,
    respostas,
    falhas,
    leadsImportados,
    leadsAtivos,
    leadsEmRemarketing,
    leadsResponderam,
    leadsInteressados,
    leadsFinalizados,
    leadsOptOut,
    campanhasAtivas,
    campanhasPausadas,
    campanhasConcluidas,
    contatosSincronizados,
    anotacoesRealizadas,
    errosIntegracao
  ] = await Promise.all([
    prisma.mensagem.count({ where: { direcao: "ENVIADA", criadoEm: { gte: inicioHoje } } }),
    prisma.mensagem.count({ where: { direcao: "ENVIADA" } }),
    prisma.mensagem.count({ where: { direcao: "ENVIADA", status: "ENTREGUE" } }),
    prisma.mensagem.count({ where: { direcao: "RECEBIDA" } }),
    prisma.mensagem.count({ where: { direcao: "ENVIADA", status: "FALHOU" } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { status: { in: ["EMAIL_ENVIADO", "EM_REMARKETING", "EM_ATENDIMENTO"] } } }),
    prisma.lead.count({ where: { status: "EM_REMARKETING" } }),
    prisma.lead.count({ where: { status: "RESPONDEU" } }),
    prisma.lead.count({ where: { status: "INTERESSADO" } }),
    prisma.lead.count({ where: { status: { in: ["ENCERRADO", "CONVERTIDO"] } } }),
    prisma.lead.count({ where: { status: "OPT_OUT" } }),
    prisma.campanha.count({ where: { status: "ATIVA" } }),
    prisma.campanha.count({ where: { status: "PAUSADA" } }),
    prisma.campanha.count({ where: { status: "CONCLUIDA" } }),
    prisma.lead.count({ where: { chatguruStatus: "SINCRONIZADO" } }),
    prisma.chatGuruEvento.count({ where: { tipo: "ADICIONAR_ANOTACAO", sucesso: true } }),
    prisma.chatGuruEvento.count({ where: { sucesso: false } })
  ]);

  return {
    email: { enviadosHoje, enviadosPeriodo, entregues, respostas, falhas },
    leads: { leadsImportados, leadsAtivos, leadsEmRemarketing, leadsResponderam, leadsInteressados, leadsFinalizados, leadsOptOut },
    campanhas: { campanhasAtivas, campanhasPausadas, campanhasConcluidas },
    chatguru: { contatosSincronizados, anotacoesRealizadas, errosIntegracao }
  };
}

export default async function DashboardPage() {
  const stats = await carregarEstatisticas();

  return (
    <div>
      <PageHeader titulo="Dashboard" descricao="Visão geral de e-mails, leads, campanhas e integração ChatGuru" />

      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">E-mails</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Enviados hoje" value={stats.email.enviadosHoje} />
          <StatCard label="Enviados no período" value={stats.email.enviadosPeriodo} />
          <StatCard label="Entregues" value={stats.email.entregues} />
          <StatCard label="Respostas" value={stats.email.respostas} />
          <StatCard label="Falhas" value={stats.email.falhas} />
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Leads</h2>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <StatCard label="Importados" value={stats.leads.leadsImportados} />
          <StatCard label="Ativos" value={stats.leads.leadsAtivos} />
          <StatCard label="Em remarketing" value={stats.leads.leadsEmRemarketing} />
          <StatCard label="Responderam" value={stats.leads.leadsResponderam} />
          <StatCard label="Interessados" value={stats.leads.leadsInteressados} />
          <StatCard label="Finalizados" value={stats.leads.leadsFinalizados} />
          <StatCard label="Opt-out" value={stats.leads.leadsOptOut} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Campanhas</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Ativas" value={stats.campanhas.campanhasAtivas} />
            <StatCard label="Pausadas" value={stats.campanhas.campanhasPausadas} />
            <StatCard label="Concluídas" value={stats.campanhas.campanhasConcluidas} />
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">ChatGuru</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Contatos sincronizados" value={stats.chatguru.contatosSincronizados} />
            <StatCard label="Anotações realizadas" value={stats.chatguru.anotacoesRealizadas} />
            <StatCard label="Erros de integração" value={stats.chatguru.errosIntegracao} />
          </div>
        </Card>
      </div>
    </div>
  );
}
