import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/session";
import NotificacoesList from "./NotificacoesList";

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
        <NotificacoesList notificacoesIniciais={notificacoes} />
      </Card>
    </div>
  );
}
