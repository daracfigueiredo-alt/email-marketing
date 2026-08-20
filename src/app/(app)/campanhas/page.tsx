import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";
import CampanhaActions from "./CampanhaActions";

const STATUS_LABEL: Record<string, string> = { ATIVA: "Ativa", PAUSADA: "Pausada", CONCLUIDA: "Concluída" };
const STATUS_COR: Record<string, string> = {
  ATIVA: "bg-green-50 text-green-700",
  PAUSADA: "bg-amber-50 text-amber-700",
  CONCLUIDA: "bg-slate-100 text-slate-600"
};

export default async function CampanhasPage() {
  const campanhas = await prisma.campanha.findMany({
    include: { etapas: true, _count: { select: { leads: true } } },
    orderBy: { criadoEm: "desc" }
  });

  return (
    <div>
      <PageHeader
        titulo="Campanhas"
        descricao="Sequências de remarketing por e-mail"
        acao={
          <Link href="/campanhas/nova" className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2">
            NOVA CAMPANHA
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campanhas.map((c) => (
          <Card key={c.id}>
            <div className="flex justify-between items-start mb-2">
              <Link href={`/campanhas/${c.id}`} className="font-medium text-slate-800 hover:text-brand-600 hover:underline">
                {c.nome}
              </Link>
              <span className={`text-xs px-2 py-1 rounded ${STATUS_COR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            </div>
            {c.descricao && <p className="text-sm text-slate-500 mb-2">{c.descricao}</p>}
            <p className="text-xs text-slate-400">
              {c.etapas.length} etapas · a cada {c.intervaloDias} dias · {c._count.leads} leads
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Link href={`/campanhas/${c.id}/editar`} className="text-xs text-brand-600 hover:underline">
                Editar
              </Link>
              <CampanhaActions id={c.id} />
            </div>
          </Card>
        ))}
        {campanhas.length === 0 && (
          <p className="text-sm text-slate-400 col-span-2 text-center py-10">Nenhuma campanha cadastrada ainda.</p>
        )}
      </div>
    </div>
  );
}
