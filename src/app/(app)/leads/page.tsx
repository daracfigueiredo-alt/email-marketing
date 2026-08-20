import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";

const STATUS_LABEL: Record<string, string> = {
  NOVO: "Novo",
  EM_REMARKETING: "Em remarketing",
  EMAIL_ENVIADO: "E-mail enviado",
  RESPONDEU: "Respondeu",
  EM_ATENDIMENTO: "Em atendimento",
  INTERESSADO: "Interessado",
  REUNIAO: "Reunião",
  CONVERTIDO: "Convertido",
  NAO_INTERESSADO: "Não interessado",
  ENCERRADO: "Encerrado",
  BLOQUEADO: "Bloqueado",
  OPT_OUT: "Opt-out"
};

export default async function LeadsPage({ searchParams }: { searchParams: { status?: string; busca?: string } }) {
  const leads = await prisma.lead.findMany({
    where: {
      status: (searchParams.status as any) || undefined,
      OR: searchParams.busca
        ? [
            { nome: { contains: searchParams.busca, mode: "insensitive" } },
            { email: { contains: searchParams.busca, mode: "insensitive" } }
          ]
        : undefined
    },
    include: { responsavel: true, campanha: true },
    orderBy: { criadoEm: "desc" },
    take: 100
  });

  return (
    <div>
      <PageHeader
        titulo="Leads"
        descricao="Todos os leads importados e seu andamento no remarketing"
        acao={
          <Link href="/leads/import" className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2">
            IMPORTAR PLANILHA
          </Link>
        }
      />

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">E-mail</th>
              <th className="text-left px-4 py-2">Telefone</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Campanha</th>
              <th className="text-left px-4 py-2">Etapa</th>
              <th className="text-left px-4 py-2">ChatGuru</th>
              <th className="text-left px-4 py-2">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/leads/${lead.id}`} className="text-brand-600 hover:underline">
                    {lead.nome}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{lead.email || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{lead.telefone || "—"}</td>
                <td className="px-4 py-2">
                  <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{STATUS_LABEL[lead.status]}</span>
                </td>
                <td className="px-4 py-2 text-slate-600">{lead.campanha?.nome || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{lead.etapaAtual}</td>
                <td className="px-4 py-2 text-slate-600">{lead.chatguruStatus === "SINCRONIZADO" ? "✓" : lead.chatguruStatus === "ERRO" ? "Erro" : "—"}</td>
                <td className="px-4 py-2 text-slate-600">{lead.responsavel?.nome || "—"}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-400 py-10">
                  Nenhum lead cadastrado ainda. Importe uma planilha para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
