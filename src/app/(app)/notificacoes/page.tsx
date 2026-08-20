import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/session";

const ICONE: Record<string, string> = {
  NOVA_RESPOSTA: "🔔",
  ERRO_ENVIO: "⚠️",
  CAMPANHA_CONCLUIDA: "✅",
  ERRO_CHATGURU: "🔌",
  CONTA_EMAIL_DESCONECTADA: "🔌",
  LEAD_INTERESSADO: "⭐",
  NOVO_ATENDIMENTO: "💬"
};

export default async function NotificacoesPage() {
  const usuario = await exigirUsuario();
  const notificacoes = await prisma.notificacao.findMany({
    where: { destinatarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 50
  });

  return (
    <div>
      <PageHeader titulo="Notificações" />
      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {notificacoes.map((n) => (
            <li key={n.id} className={`px-4 py-3 flex items-start gap-3 ${n.lida ? "" : "bg-brand-50"}`}>
              <span className="text-lg">{ICONE[n.tipo] ?? "🔔"}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{n.titulo}</p>
                <p className="text-sm text-slate-600">{n.mensagem}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(n.criadoEm).toLocaleString("pt-BR")}</p>
              </div>
              {n.leadId && (
                <Link href={`/leads/${n.leadId}`} className="text-xs text-brand-600 hover:underline shrink-0">
                  Ver lead
                </Link>
              )}
            </li>
          ))}
          {notificacoes.length === 0 && <li className="text-center text-slate-400 py-10 text-sm">Nenhuma notificação ainda.</li>}
        </ul>
      </Card>
    </div>
  );
}
