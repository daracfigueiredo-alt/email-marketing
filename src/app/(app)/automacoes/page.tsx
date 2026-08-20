import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";
import RodarAgoraButton from "./RodarAgoraButton";

export default async function AutomacoesPage() {
  const [logs, filaPendente, filaProcessando, filaFalhou, filaCancelada] = await Promise.all([
    prisma.logAuditoria.findMany({ where: { acao: "EXECUTOU_CICLO_REMARKETING" }, orderBy: { criadoEm: "desc" }, take: 10 }),
    prisma.filaEnvio.count({ where: { status: "PENDENTE" } }),
    prisma.filaEnvio.count({ where: { status: "PROCESSANDO" } }),
    prisma.filaEnvio.count({ where: { status: "FALHOU" } }),
    prisma.filaEnvio.count({ where: { status: "CANCELADO" } })
  ]);

  return (
    <div>
      <PageHeader
        titulo="Automações"
        descricao="Motor de remarketing em duas fases: agenda os próximos envios na fila e depois processa a fila respeitando limites de disparo e retentativa controlada."
        acao={<RodarAgoraButton />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase text-slate-500">Na fila (pendente)</p>
          <p className="text-2xl font-semibold">{filaPendente}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Processando</p>
          <p className="text-2xl font-semibold">{filaProcessando}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Falharam (esgotaram tentativas)</p>
          <p className="text-2xl font-semibold">{filaFalhou}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Canceladas</p>
          <p className="text-2xl font-semibold">{filaCancelada}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Histórico de execuções</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left py-1">Data/hora</th>
              <th className="text-left py-1">Agendados</th>
              <th className="text-left py-1">Enviados</th>
              <th className="text-left py-1">Falhas</th>
              <th className="text-left py-1">Canceladas</th>
              <th className="text-left py-1">Adiadas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => {
              const d = log.detalhes as any;
              return (
                <tr key={log.id}>
                  <td className="py-2">{new Date(log.criadoEm).toLocaleString("pt-BR")}</td>
                  <td className="py-2">{d?.agendados ?? "—"}</td>
                  <td className="py-2">{d?.enviados ?? "—"}</td>
                  <td className="py-2">{d?.falhas ?? "—"}</td>
                  <td className="py-2">{d?.canceladas ?? "—"}</td>
                  <td className="py-2">{d?.adiadas ?? "—"}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-6">
                  Nenhuma execução registrada. Configure um cron externo apontando para POST /api/automacoes/run,
                  ou clique em "Rodar agora".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
