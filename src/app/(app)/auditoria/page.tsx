import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";

export default async function AuditoriaPage() {
  const logs = await prisma.logAuditoria.findMany({
    include: { usuario: true },
    orderBy: { criadoEm: "desc" },
    take: 200
  });

  return (
    <div>
      <PageHeader titulo="Auditoria" descricao="Todas as ações relevantes realizadas no sistema, com o usuário responsável" />

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Data/hora</th>
              <th className="text-left px-4 py-2">Usuário</th>
              <th className="text-left px-4 py-2">Ação</th>
              <th className="text-left px-4 py-2">Entidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-2 text-slate-500">{new Date(log.criadoEm).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2">{log.usuario?.nome || "Sistema"}</td>
                <td className="px-4 py-2">{log.acao}</td>
                <td className="px-4 py-2 text-slate-500">{log.entidade ? `${log.entidade} #${log.entidadeId?.slice(0, 8)}` : "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 py-10">
                  Nenhuma ação registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
