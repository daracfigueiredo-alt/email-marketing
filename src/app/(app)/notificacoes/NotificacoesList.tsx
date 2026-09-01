"use client";
import { useState } from "react";
import Link from "next/link";

const ICONE: Record<string, string> = {
  NOVA_RESPOSTA: "🔔",
  ERRO_ENVIO: "⚠️",
  CAMPANHA_CONCLUIDA: "✅",
  ERRO_CHATGURU: "🔌",
  CONTA_EMAIL_DESCONECTADA: "🔌",
  LEAD_INTERESSADO: "⭐",
  NOVO_ATENDIMENTO: "💬"
};

interface NotificacaoItem {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  criadoEm: string | Date;
  lida: boolean;
  leadId: string | null;
}

export default function NotificacoesList({ notificacoesIniciais }: { notificacoesIniciais: NotificacaoItem[] }) {
  const [notificacoes, setNotificacoes] = useState(notificacoesIniciais);
  const temNaoLidas = notificacoes.some((n) => !n.lida);

  async function marcarComoLida(id: string) {
    setNotificacoes((atual) => atual.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    try {
      await fetch("/api/notificacoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, lida: true })
      });
    } catch {
      // se a chamada falhar, a próxima checagem do sino (a cada 20s) corrige o estado
    }
  }

  async function marcarTodasComoLidas() {
    setNotificacoes((atual) => atual.map((n) => ({ ...n, lida: true })));
    try {
      await fetch("/api/notificacoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todas: true })
      });
    } catch {
      // idem — corrige sozinho na próxima checagem
    }
  }

  return (
    <div>
      {temNaoLidas && (
        <div className="flex justify-end mb-3">
          <button onClick={marcarTodasComoLidas} className="text-xs text-brand-600 hover:underline">
            Marcar todas como lidas
          </button>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {notificacoes.map((n) => (
          <li
            key={n.id}
            onClick={() => !n.lida && marcarComoLida(n.id)}
            className={`px-4 py-3 flex items-start gap-3 ${n.lida ? "" : "bg-brand-50 cursor-pointer"}`}
          >
            <span className="text-lg">{ICONE[n.tipo] ?? "🔔"}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{n.titulo}</p>
              <p className="text-sm text-slate-600">{n.mensagem}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date(n.criadoEm).toLocaleString("pt-BR")}</p>
            </div>
            {n.leadId && (
              <Link href={`/leads/${n.leadId}`} onClick={(e) => e.stopPropagation()} className="text-xs text-brand-600 hover:underline shrink-0">
                Ver lead
              </Link>
            )}
          </li>
        ))}
        {notificacoes.length === 0 && <li className="text-center text-slate-400 py-10 text-sm">Nenhuma notificação ainda.</li>}
      </ul>
    </div>
  );
}
