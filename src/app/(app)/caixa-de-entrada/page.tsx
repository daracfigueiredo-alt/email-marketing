import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ThreadView from "./ThreadView";

const PASTAS = [
  { valor: "ENTRADA", rotulo: "Entrada" },
  { valor: "ENVIADOS", rotulo: "Enviados" },
  { valor: "RASCUNHOS", rotulo: "Rascunhos" },
  { valor: "ARQUIVADOS", rotulo: "Arquivados" },
  { valor: "IMPORTANTES", rotulo: "Importantes" },
  { valor: "LIXEIRA", rotulo: "Lixeira" },
  { valor: "SPAM", rotulo: "Spam" }
] as const;

export default async function CaixaDeEntradaPage({ searchParams }: { searchParams: { pasta?: string; lead?: string } }) {
  const pasta = (searchParams.pasta as any) || "ENTRADA";

  // Uma "conversa" = um lead com pelo menos uma mensagem na pasta selecionada.
  const mensagens = await prisma.mensagem.findMany({
    where: { pasta },
    orderBy: { criadoEm: "desc" },
    include: { lead: true },
    take: 200
  });
  const conversas = Array.from(new Map(mensagens.map((m) => [m.leadId, m])).values());

  const leadSelecionado = searchParams.lead || conversas[0]?.leadId;
  const thread = leadSelecionado
    ? await prisma.mensagem.findMany({ where: { leadId: leadSelecionado }, orderBy: { criadoEm: "asc" }, include: { usuario: true } })
    : [];
  const lead = leadSelecionado ? await prisma.lead.findUnique({ where: { id: leadSelecionado } }) : null;

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6">
      {/* Pastas */}
      <div className="w-44 shrink-0 border-r border-slate-200 bg-white py-4">
        {PASTAS.map((p) => (
          <Link
            key={p.valor}
            href={`/caixa-de-entrada?pasta=${p.valor}`}
            className={`block px-4 py-2 text-sm ${pasta === p.valor ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {p.rotulo}
          </Link>
        ))}
      </div>

      {/* Lista de conversas */}
      <div className="w-80 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
        {conversas.map((c) => (
          <Link
            key={c.leadId}
            href={`/caixa-de-entrada?pasta=${pasta}&lead=${c.leadId}`}
            className={`block px-4 py-3 border-b border-slate-100 ${leadSelecionado === c.leadId ? "bg-brand-50" : "hover:bg-slate-50"}`}
          >
            <p className="text-sm font-medium text-slate-800 truncate">{c.lead.nome}</p>
            <p className="text-xs text-slate-500 truncate">{c.assunto || c.corpo.slice(0, 60)}</p>
            <p className="text-xs text-slate-400 mt-1">{new Date(c.criadoEm).toLocaleString("pt-BR")}</p>
          </Link>
        ))}
        {conversas.length === 0 && <p className="text-sm text-slate-400 text-center py-10 px-4">Nenhuma conversa nesta pasta.</p>}
      </div>

      {/* Conversa selecionada */}
      <div className="flex-1 bg-slate-50 overflow-y-auto">
        {lead ? <ThreadView lead={lead} thread={thread as any} /> : <p className="text-sm text-slate-400 text-center py-10">Selecione uma conversa.</p>}
      </div>
    </div>
  );
}
