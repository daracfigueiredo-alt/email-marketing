import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import { prisma } from "@/lib/prisma";

export default async function ChatGuruPage() {
  const configurado = !!(process.env.CHATGURU_API_KEY && process.env.CHATGURU_ACCOUNT_ID);

  const [sincronizados, comErro, naoSincronizados, eventosRecentes] = await Promise.all([
    prisma.lead.count({ where: { chatguruStatus: "SINCRONIZADO" } }),
    prisma.lead.count({ where: { chatguruStatus: "ERRO" } }),
    prisma.lead.count({ where: { chatguruStatus: "NAO_SINCRONIZADO" } }),
    prisma.chatGuruEvento.findMany({ orderBy: { criadoEm: "desc" }, take: 20 })
  ]);

  return (
    <div>
      <PageHeader
        titulo="ChatGuru"
        descricao={configurado ? "Integração configurada" : "Integração não configurada — preencha CHATGURU_* nas variáveis de ambiente"}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Contatos sincronizados" value={sincronizados} />
        <StatCard label="Não sincronizados" value={naoSincronizados} />
        <StatCard label="Com erro" value={comErro} />
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Eventos recentes</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left py-1">Data/hora</th>
              <th className="text-left py-1">Tipo</th>
              <th className="text-left py-1">Status</th>
              <th className="text-left py-1">Detalhe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {eventosRecentes.map((e) => (
              <tr key={e.id}>
                <td className="py-2">{new Date(e.criadoEm).toLocaleString("pt-BR")}</td>
                <td className="py-2">{e.tipo}</td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-1 rounded ${e.sucesso ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {e.sucesso ? "OK" : "Erro"}
                  </span>
                </td>
                <td className="py-2 text-slate-500">{e.erro || "—"}</td>
              </tr>
            ))}
            {eventosRecentes.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 py-6">
                  Nenhum evento registrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
