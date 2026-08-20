export default function PageHeader({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>
        {descricao && <p className="text-sm text-slate-500 mt-1">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}
