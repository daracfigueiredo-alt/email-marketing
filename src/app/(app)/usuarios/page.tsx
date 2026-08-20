import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/session";

const PERFIL_LABEL: Record<string, string> = { ADMINISTRADOR: "Administrador", SUPERVISOR: "Supervisor", OPERADOR: "Operador/SDR" };

export default async function UsuariosPage() {
  await exigirAdmin();
  const usuarios = await prisma.usuario.findMany({ orderBy: { criadoEm: "desc" } });

  return (
    <div>
      <PageHeader
        titulo="Usuários"
        descricao="Gestão de acessos ao sistema"
        acao={
          <Link href="/usuarios/novo" className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2">
            NOVO USUÁRIO
          </Link>
        }
      />

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">E-mail</th>
              <th className="text-left px-4 py-2">Login</th>
              <th className="text-left px-4 py-2">Perfil</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Último acesso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">{u.nome}</td>
                <td className="px-4 py-2 text-slate-600">{u.email}</td>
                <td className="px-4 py-2 text-slate-600">{u.login}</td>
                <td className="px-4 py-2">{PERFIL_LABEL[u.perfil]}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-1 rounded ${u.status === "ATIVO" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {u.status === "ATIVO" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500">{u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleString("pt-BR") : "Nunca acessou"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
