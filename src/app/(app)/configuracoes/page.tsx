import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { exigirAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function StatusLinha({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={`text-xs px-2 py-1 rounded ${ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
        {ok ? "Configurado" : "Não configurado"}
      </span>
    </div>
  );
}

const PROVEDOR_LABEL: Record<string, string> = {
  GMAIL: "Gmail",
  GOOGLE_WORKSPACE: "Google Workspace",
  OUTLOOK: "Outlook",
  MICROSOFT_365: "Microsoft 365"
};

export default async function ConfiguracoesPage({
  searchParams
}: {
  searchParams: { gmail_ok?: string; gmail_erro?: string; outlook_ok?: string; outlook_erro?: string };
}) {
  await exigirAdmin();

  // Nunca expor os valores das credenciais — apenas se estão presentes ou não.
  const gmailAppOk = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REDIRECT_URI);
  const outlookAppOk = !!(process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_CLIENT_SECRET && process.env.OUTLOOK_REDIRECT_URI);
  const chatguruOk = !!(process.env.CHATGURU_API_KEY && process.env.CHATGURU_ACCOUNT_ID);
  const dbOk = !!process.env.DATABASE_URL;
  const criptografiaOk = !!process.env.ENCRYPTION_KEY;

  const contas = await prisma.contaEmail.findMany({ orderBy: { criadoEm: "desc" }, include: { usuario: true } });

  return (
    <div>
      <PageHeader titulo="Configurações" descricao="Integrações e parâmetros gerais. Credenciais ficam apenas em variáveis de ambiente no servidor." />

      {searchParams.gmail_ok && <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 mb-4">Conta Gmail conectada com sucesso.</p>}
      {searchParams.gmail_erro && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">Falha ao conectar Gmail: {searchParams.gmail_erro}</p>}
      {searchParams.outlook_ok && <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 mb-4">Conta Outlook conectada com sucesso.</p>}
      {searchParams.outlook_erro && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">Falha ao conectar Outlook: {searchParams.outlook_erro}</p>}

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Contas de e-mail conectadas</h2>
          <div className="flex gap-2">
            <a
              href="/api/integrations/gmail/authorize"
              className={`text-xs rounded-md px-3 py-1.5 ${gmailAppOk ? "bg-brand-500 hover:bg-brand-600 text-white" : "bg-slate-100 text-slate-400 pointer-events-none"}`}
            >
              Conectar conta Gmail
            </a>
            <a
              href="/api/integrations/outlook/authorize"
              className={`text-xs rounded-md px-3 py-1.5 ${outlookAppOk ? "bg-brand-500 hover:bg-brand-600 text-white" : "bg-slate-100 text-slate-400 pointer-events-none"}`}
            >
              Conectar conta Outlook
            </a>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left py-1">Conta</th>
              <th className="text-left py-1">Provedor</th>
              <th className="text-left py-1">Nome do remetente</th>
              <th className="text-left py-1">Dono</th>
              <th className="text-left py-1">Status</th>
              <th className="text-left py-1">Limites</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contas.map((c) => (
              <tr key={c.id}>
                <td className="py-2">{c.emailConta}</td>
                <td className="py-2">{PROVEDOR_LABEL[c.provedor]}</td>
                <td className="py-2">{c.nomeRemetente}</td>
                <td className="py-2 text-slate-500">{c.usuario.nome}</td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-1 rounded ${c.ativa ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.ativa ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="py-2 text-slate-500 text-xs">
                  {c.limitePorHora}/hora · {c.limitePorDia}/dia · {c.horarioInicioPermitido}–{c.horarioFimPermitido}
                </td>
              </tr>
            ))}
            {contas.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-6">
                  Nenhuma conta conectada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {!gmailAppOk && (
          <p className="text-xs text-slate-400 mt-3">
            Para habilitar "Conectar conta Gmail", preencha GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REDIRECT_URI no ambiente.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Segurança</h2>
          <StatusLinha label="Chave de criptografia (ENCRYPTION_KEY)" ok={criptografiaOk} />
          <p className="text-xs text-slate-400 mt-3">Usada para cifrar o refresh_token das contas de e-mail conectadas antes de salvar no banco. Gere com `openssl rand -hex 32`.</p>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">ChatGuru</h2>
          <StatusLinha label="Conexão" ok={chatguruOk} />
          <p className="text-xs text-slate-400 mt-3">Configure CHATGURU_API_KEY, CHATGURU_ACCOUNT_ID e CHATGURU_BASE_URL no ambiente (.env).</p>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Banco de dados</h2>
          <StatusLinha label="Conexão" ok={dbOk} />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Automação</h2>
          <div className="text-sm text-slate-600">
            Intervalo padrão de remarketing: <strong>{process.env.REMARKETING_INTERVAL_DAYS || 3} dias</strong>
          </div>
          <p className="text-xs text-slate-400 mt-3">Ajustável por campanha na tela de criação. Global via REMARKETING_INTERVAL_DAYS.</p>
        </Card>
      </div>
    </div>
  );
}
