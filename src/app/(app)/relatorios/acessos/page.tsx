import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/session";

type Filtro = "hoje" | "ontem" | "semana" | "mes" | "personalizado";

function calcularIntervalo(filtro: Filtro, de?: string, ate?: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (filtro === "ontem") {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 1);
    return { inicio, fim: hoje };
  }
  if (filtro === "semana") {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 7);
    return { inicio, fim: undefined };
  }
  if (filtro === "mes") {
    const inicio = new Date(hoje);
    inicio.setMonth(inicio.getMonth() - 1);
    return { inicio, fim: undefined };
  }
  if (filtro === "personalizado" && de) {
    return { inicio: new Date(de), fim: ate ? new Date(ate) : undefined };
  }
  return { inicio: hoje, fim: undefined };
}

function formatarDuracao(ms: number) {
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  return `${horas}h${String(minutos).padStart(2, "0")}`;
}

export default async function RelatorioAcessosPage({
  searchParams
}: {
  searchParams: { filtro?: Filtro; de?: string; ate?: string; usuario?: string };
}) {
  await exigirAdmin();
  const filtro = searchParams.filtro || "hoje";
  const { inicio, fim } = calcularIntervalo(filtro, searchParams.de, searchParams.ate);

  const usuarios = await prisma.usuario.findMany({ orderBy: { nome: "asc" } });

  const sessoes = await prisma.sessaoLogin.findMany({
    where: {
      entrada: { gte: inicio, lte: fim },
      usuarioId: searchParams.usuario || undefined
    },
    include: { usuario: true },
    orderBy: { entrada: "desc" },
    take: 300
  });

  const FILTROS: { valor: Filtro; rotulo: string }[] = [
    { valor: "hoje", rotulo: "Hoje" },
    { valor: "ontem", rotulo: "Ontem" },
    { valor: "semana", rotulo: "Semana" },
    { valor: "mes", rotulo: "Mês" }
  ];

  return (
    <div>
      <PageHeader titulo="Relatório de Acessos" descricao="Login, logout e duração de sessão por usuário" />

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTROS.map((f) => (
          <a
            key={f.valor}
            href={`/relatorios/acessos?filtro=${f.valor}`}
            className={`text-xs rounded-md px-3 py-1.5 border ${filtro === f.valor ? "bg-brand-500 text-white border-brand-500" : "border-slate-300 hover:bg-slate-50"}`}
          >
            {f.rotulo}
          </a>
        ))}
        <form className="flex items-center gap-2" action="/relatorios/acessos" method="get">
          <input type="hidden" name="filtro" value="personalizado" />
          <input type="date" name="de" defaultValue={searchParams.de} className="text-xs border border-slate-300 rounded-md px-2 py-1.5" />
          <input type="date" name="ate" defaultValue={searchParams.ate} className="text-xs border border-slate-300 rounded-md px-2 py-1.5" />
          <select name="usuario" defaultValue={searchParams.usuario || ""} className="text-xs border border-slate-300 rounded-md px-2 py-1.5">
            <option value="">Todos os usuários</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <button type="submit" className="text-xs border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50">
            Aplicar
          </button>
        </form>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Usuário</th>
              <th className="text-left px-4 py-2">Entrada</th>
              <th className="text-left px-4 py-2">Saída</th>
              <th className="text-left px-4 py-2">Duração</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessoes.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2">{s.usuario.nome}</td>
                <td className="px-4 py-2 text-slate-600">{new Date(s.entrada).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2 text-slate-600">{s.saida ? new Date(s.saida).toLocaleString("pt-BR") : "Sessão em aberto"}</td>
                <td className="px-4 py-2 text-slate-600">{s.saida ? formatarDuracao(new Date(s.saida).getTime() - new Date(s.entrada).getTime()) : "—"}</td>
              </tr>
            ))}
            {sessoes.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 py-10">
                  Nenhuma sessão registrada no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
