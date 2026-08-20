import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";

function BotoesExportar({ tipo }: { tipo: string }) {
  return (
    <div className="flex gap-2 mt-3">
      <a href={`/api/relatorios/exportar?tipo=${tipo}&formato=pdf`} className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50">
        Gerar PDF
      </a>
      <a href={`/api/relatorios/exportar?tipo=${tipo}&formato=xlsx`} className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50">
        Exportar Excel
      </a>
      <a href={`/api/relatorios/exportar?tipo=${tipo}&formato=csv`} className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50">
        Exportar CSV
      </a>
    </div>
  );
}

export default async function RelatoriosPage() {
  const [porStatusLead, porStatusCampanha, porResponsavel, usuarios] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.campanha.groupBy({ by: ["status"], _count: true }),
    prisma.lead.groupBy({ by: ["responsavelId"], _count: true }),
    prisma.usuario.findMany({ orderBy: { nome: "asc" } })
  ]);

  // Seção 42 — atividade por usuário (campanhas criadas, e-mails enviados manualmente, leads sob responsabilidade)
  const atividadePorUsuario = await Promise.all(
    usuarios.map(async (u) => {
      const [campanhasCriadas, emailsEnviados, leadsResponsavel] = await Promise.all([
        prisma.campanha.count({ where: { criadorId: u.id } }),
        prisma.mensagem.count({ where: { usuarioId: u.id, direcao: "ENVIADA" } }),
        prisma.lead.count({ where: { responsavelId: u.id } })
      ]);
      return { nome: u.nome, campanhasCriadas, emailsEnviados, leadsResponsavel };
    })
  );

  const responsaveis = await prisma.usuario.findMany({
    where: { id: { in: porResponsavel.map((r) => r.responsavelId).filter((x): x is string => !!x) } }
  });
  const nomeResponsavel = new Map(responsaveis.map((u) => [u.id, u.nome]));

  return (
    <div>
      <PageHeader titulo="Relatórios" descricao="Visão consolidada para o administrador. Todo relatório pode ser exportado em PDF, Excel ou CSV." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Leads por status</h2>
          <ul className="text-sm space-y-1">
            {porStatusLead.map((item) => (
              <li key={item.status} className="flex justify-between">
                <span className="text-slate-600">{item.status}</span>
                <span className="font-medium">{item._count}</span>
              </li>
            ))}
          </ul>
          <BotoesExportar tipo="leads-por-status" />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Campanhas por status</h2>
          <ul className="text-sm space-y-1">
            {porStatusCampanha.map((item) => (
              <li key={item.status} className="flex justify-between">
                <span className="text-slate-600">{item.status}</span>
                <span className="font-medium">{item._count}</span>
              </li>
            ))}
          </ul>
          <BotoesExportar tipo="campanhas-por-status" />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Leads por responsável</h2>
          <ul className="text-sm space-y-1">
            {porResponsavel.map((item) => (
              <li key={item.responsavelId ?? "sem-responsavel"} className="flex justify-between">
                <span className="text-slate-600">{item.responsavelId ? nomeResponsavel.get(item.responsavelId) ?? "—" : "Sem responsável"}</span>
                <span className="font-medium">{item._count}</span>
              </li>
            ))}
          </ul>
          <BotoesExportar tipo="leads-por-responsavel" />
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Atividade por usuário</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left py-1">Usuário</th>
              <th className="text-left py-1">Campanhas criadas</th>
              <th className="text-left py-1">E-mails enviados manualmente</th>
              <th className="text-left py-1">Leads sob responsabilidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {atividadePorUsuario.map((a) => (
              <tr key={a.nome}>
                <td className="py-2">{a.nome}</td>
                <td className="py-2">{a.campanhasCriadas}</td>
                <td className="py-2">{a.emailsEnviados}</td>
                <td className="py-2">{a.leadsResponsavel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-slate-400 mt-6">
        Relatório de campanha individual (envio, entrega, respostas, opt-outs) disponível na página de cada campanha. Relatório de login/sessões em{" "}
        <a href="/relatorios/acessos" className="text-brand-600 hover:underline">
          Relatórios → Acessos
        </a>
        .
      </p>
    </div>
  );
}
