"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const MENU = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/campanhas", label: "Campanhas" },
  { href: "/caixa-de-entrada", label: "Caixa de Entrada" },
  { href: "/notificacoes", label: "Notificações" },
  { href: "/modelos", label: "Modelos de E-mail" },
  { href: "/automacoes", label: "Automações" },
  { href: "/chatguru", label: "ChatGuru" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/auditoria", label: "Auditoria" },
  { href: "/usuarios", label: "Usuários" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/manual", label: "Manual de Operação" },
  { href: "/perfil", label: "Meu Perfil" }
];

interface NotificacaoResumo {
  id: string;
  lida: boolean;
}

/** Toca um alerta sonoro curto (dois tons ascendentes) usando Web Audio API — sem depender de arquivo de áudio externo. */
function tocarAlerta() {
  try {
    const AudioContextCls = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextCls();
    const tocarTom = (frequencia: number, inicio: number, duracao: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequencia;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracao);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracao);
    };
    tocarTom(880, 0, 0.12);
    tocarTom(1175, 0.13, 0.15);
  } catch {
    // navegador pode bloquear áudio sem interação prévia do usuário — falha silenciosa
  }
}

export default function Sidebar({ nomeUsuario }: { nomeUsuario?: string | null }) {
  const pathname = usePathname();
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberta, setAberta] = useState(false);
  const conhecidas = useRef<Set<string> | null>(null);

  // Fecha o menu retrátil (telas pequenas) sempre que a rota muda.
  useEffect(() => {
    setAberta(false);
  }, [pathname]);

  useEffect(() => {
    let cancelado = false;

    async function checar() {
      try {
        const resp = await fetch("/api/notificacoes");
        if (!resp.ok) return;
        const notificacoes: NotificacaoResumo[] = await resp.json();
        if (cancelado) return;

        const idsAtuais = new Set(notificacoes.map((n) => n.id));
        if (conhecidas.current === null) {
          // primeira checagem da sessão: só estabelece a base, sem tocar alerta
          conhecidas.current = idsAtuais;
        } else {
          const novas = notificacoes.filter((n) => !n.lida && !conhecidas.current!.has(n.id));
          if (novas.length > 0) tocarAlerta();
          conhecidas.current = idsAtuais;
        }
        setNaoLidas(notificacoes.filter((n) => !n.lida).length);
      } catch {
        // rede indisponível momentaneamente — tenta de novo na próxima checagem
      }
    }

    checar();
    const intervalo = setInterval(checar, 20000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  return (
    <>
      {/* Botão hambúrguer — só aparece em telas estreitas */}
      <button
        onClick={() => setAberta(true)}
        className="md:hidden fixed top-3 left-3 z-50 bg-slate-900 text-white rounded-md p-2 shadow-md"
        aria-label="Abrir menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      {/* Fundo escurecido atrás do menu aberto, em telas estreitas */}
      {aberta && <div onClick={() => setAberta(false)} className="md:hidden fixed inset-0 bg-black/50 z-40" />}

      <aside
        className={`w-60 shrink-0 bg-slate-900 text-slate-200 h-screen flex-col overflow-y-auto fixed md:sticky top-0 left-0 z-50 ${
          aberta ? "flex" : "hidden md:flex"
        }`}
      >
        <button
          onClick={() => setAberta(false)}
          className="md:hidden self-end mr-3 mt-3 text-slate-400 hover:text-white"
          aria-label="Fechar menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
        <div className="px-4 py-5 border-b border-slate-800">
          <p className="text-sm font-semibold text-white leading-tight">E-mail Marketing</p>
          <p className="text-xs text-slate-400">+ ChatGuru</p>
        </div>
      <nav className="flex-1 py-3">
        {MENU.map((item) => {
          const ativo = pathname === item.href || pathname?.startsWith(item.href + "/");
          const ehNotificacoes = item.href === "/notificacoes";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-4 py-2 text-sm ${
                ativo ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>{item.label.toUpperCase()}</span>
              {ehNotificacoes && naoLidas > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {naoLidas > 99 ? "99+" : naoLidas}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-slate-800 text-xs">
        <p className="text-slate-400 mb-2 truncate">{nomeUsuario}</p>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-slate-400 hover:text-white">
          Sair
        </button>
      </div>
      </aside>
    </>
  );
}
