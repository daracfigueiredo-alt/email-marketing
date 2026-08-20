import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { prisma } from "@/lib/prisma";
import ModeloActions from "./ModeloActions";

export default async function ModelosPage() {
  const modelos = await prisma.modeloEmail.findMany({ orderBy: { criadoEm: "desc" } });

  return (
    <div>
      <PageHeader
        titulo="Modelos de E-mail"
        descricao="Mensagens pré-cadastradas usadas nas campanhas. Use {{nome}} e {{empresa}} para personalizar."
        acao={
          <Link href="/modelos/novo" className="bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-md px-4 py-2">
            NOVO MODELO
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modelos.map((m) => (
          <Card key={m.id}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-slate-800">{m.nome}</h3>
              <span className={`text-xs px-2 py-1 rounded ${m.ativo ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {m.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-2">Assunto: {m.assunto}</p>
            <p className="text-sm text-slate-600 line-clamp-3">{m.corpoHtml.replace(/<[^>]+>/g, " ")}</p>
            <ModeloActions id={m.id} />
          </Card>
        ))}
        {modelos.length === 0 && (
          <p className="text-sm text-slate-400 col-span-2 text-center py-10">Nenhum modelo cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
