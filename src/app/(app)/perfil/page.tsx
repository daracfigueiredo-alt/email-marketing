import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { exigirUsuario } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PerfilForm from "./PerfilForm";

export default async function PerfilPage() {
  const usuarioSessao = await exigirUsuario();
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioSessao.id } });

  return (
    <div>
      <PageHeader titulo="Meu Perfil" />
      <Card className="max-w-md">
        <p className="text-sm text-slate-500 mb-4">
          {usuario.email} · {usuario.login} · {usuario.perfil}
        </p>
        <PerfilForm nomeAtual={usuario.nome} />
      </Card>
    </div>
  );
}
