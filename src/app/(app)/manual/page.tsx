"use client";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/Card";

const ETAPAS_FLUXO = [
  { titulo: "Linha nova na planilha", desc: "Nome, e-mail e telefone entram na planilha do Google Sheets, sem status na coluna H.", tipo: "manual" as const },
  { titulo: "Sistema identifica e importa", desc: "A cada 1 minuto, o sistema lê a planilha e cria o lead na campanha configurada.", tipo: "auto" as const },
  { titulo: "Primeiro e-mail sai", desc: "Modelo da etapa 1 é personalizado com o nome do lead e enviado pela conta Gmail conectada.", tipo: "auto" as const },
  { titulo: "Planilha é marcada", desc: 'A coluna H recebe "enviado" — dá pra acompanhar direto na planilha quem já foi contatado.', tipo: "auto" as const },
  { titulo: "Remarketing continua", desc: "Se não houver resposta, a próxima etapa (2, 3, 4…) sai no intervalo configurado da campanha.", tipo: "auto" as const },
  { titulo: "Lead responde, sequência para", desc: "Resposta detectada por e-mail interrompe o remarketing na hora e avisa o responsável.", tipo: "auto" as const },
  { titulo: "Atendimento humano assume", desc: "A partir daqui é conversa — pela Caixa de Entrada do sistema ou pelo ChatGuru.", tipo: "manual" as const }
];

const AUTOMATICO = [
  { icone: "📥", titulo: "Importar leads", desc: 'Lê a planilha, ignora quem já está marcado "enviado", cria os novos.' },
  { icone: "✉️", titulo: "Disparar e-mails", desc: "Respeita a sequência de etapas de cada campanha e o intervalo entre elas." },
  { icone: "📝", titulo: "Marcar a planilha", desc: 'Escreve "enviado" na coluna de status assim que o e-mail sai.' },
  { icone: "👀", titulo: "Sincronizar respostas", desc: "Verifica a caixa do Gmail conectado e interrompe o remarketing de quem respondeu." },
  { icone: "💬", titulo: "Anotar no ChatGuru", desc: "Toda etapa enviada e toda resposta recebida vira uma anotação no contato (buscado pelo telefone)." },
  { icone: "🔔", titulo: "Notificar o time", desc: "Nova resposta ou falha de envio gera notificação com alerta sonoro no sistema." }
];

const TELAS = [
  { nome: "Dashboard", desc: "Números do dia: e-mails enviados, leads por status, campanhas ativas.", caminho: "/dashboard" },
  { nome: "Leads", desc: "Lista completa, status, campanha e etapa de cada um. Importação manual também fica aqui.", caminho: "/leads" },
  { nome: "Campanhas", desc: "Sequência de etapas, intervalo entre envios, conta de e-mail usada para enviar.", caminho: "/campanhas" },
  { nome: "Modelos de E-mail", desc: "Texto de cada etapa, com negrito, itálico e emoji. Editar não afeta o que já foi enviado.", caminho: "/modelos" },
  { nome: "Caixa de Entrada", desc: "Enviados, recebidos e rascunhos. Responder, encaminhar e ver se o lead já visualizou (✓✓).", caminho: "/caixa-de-entrada" },
  { nome: "Automações", desc: 'Botão "Rodar agora" para forçar um ciclo na hora, fora do intervalo de 1 minuto.', caminho: "/automacoes" },
  { nome: "ChatGuru", desc: "Status da conexão e contadores de contatos sincronizados/com erro.", caminho: "/chatguru" },
  { nome: "Relatórios", desc: "Desempenho por campanha, taxa de resposta, acessos por usuário — exporta em PDF/Excel/CSV.", caminho: "/relatorios" },
  { nome: "Configurações", desc: "Contas de e-mail conectadas e status de cada integração (ChatGuru, banco de dados).", caminho: "/configuracoes" }
];

const PLANILHA = [
  { coluna: "D", conteudo: "E-mail do lead", obrigatorio: "Sim — é a chave usada para identificar quem é novo" },
  { coluna: "E", conteudo: "Nome do lead", obrigatorio: "Recomendado, personaliza o e-mail" },
  { coluna: "F", conteudo: "Telefone", obrigatorio: "Recomendado — usado para o ChatGuru localizar a conversa" },
  { coluna: "G", conteudo: "Empresa", obrigatorio: "Opcional" },
  { coluna: "H", conteudo: "Status", obrigatorio: 'Deixe em branco — o sistema escreve "enviado" sozinho' }
];

const SEGURANCA = [
  { icone: "🚫", titulo: "Opt-out", desc: "Todo e-mail tem link de descadastro. Quem clica nunca mais recebe nada de nenhuma campanha." },
  { icone: "🔁", titulo: "Sem duplicidade", desc: "Cada lead só entra uma vez por e-mail/telefone, mesmo se a linha aparecer de novo na planilha." },
  { icone: "⏸️", titulo: "Campanha pausada", desc: 'Mudar o status de uma campanha para "Pausada" interrompe os envios dela imediatamente.' },
  { icone: "♻️", titulo: "Nova tentativa", desc: "Falha temporária de envio tenta de novo automaticamente, com intervalo crescente, até 5 vezes." }
];

const PAGINAS = [
  {
    numero: "01",
    titulo: "O fluxo de um lead",
    descricao: "Da linha na planilha até a resposta do cliente — é essa sequência que se repete para cada lead, sem intervenção manual.",
    conteudo: (
      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {ETAPAS_FLUXO.map((etapa, i) => (
            <li key={i} className="flex items-start gap-4 px-4 py-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-mono flex items-center justify-center mt-0.5">{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{etapa.titulo}</p>
                <p className="text-sm text-slate-500">{etapa.desc}</p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded-full ${
                  etapa.tipo === "auto" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {etapa.tipo === "auto" ? "Automático" : "Time faz"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    )
  },
  {
    numero: "02",
    titulo: "O que é 100% automático",
    descricao: "Uma tarefa roda sozinha no computador de 1 em 1 minuto, o dia inteiro, sem precisar de ninguém logado.",
    conteudo: (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {AUTOMATICO.map((item) => (
            <Card key={item.titulo}>
              <p className="text-sm font-medium text-slate-800 mb-1">
                {item.icone} {item.titulo}
              </p>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </Card>
          ))}
        </div>
        <div className="border-l-4 border-brand-500 bg-brand-50 rounded-r-md px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-wide text-brand-700 mb-1">O que isso significa na prática</p>
          <p className="text-sm text-slate-700">Ninguém precisa abrir o sistema para os e-mails saírem. Adicionar leads na planilha é o único gatilho manual do ciclo inteiro.</p>
        </div>
      </>
    )
  },
  {
    numero: "03",
    titulo: "As telas, uma a uma",
    descricao: "O que cada área do menu lateral serve para fazer.",
    conteudo: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TELAS.map((tela) => (
          <Card key={tela.caminho}>
            <p className="text-sm font-medium text-slate-800">{tela.nome}</p>
            <p className="text-sm text-slate-500 mt-1">{tela.desc}</p>
            <p className="text-xs font-mono text-slate-400 mt-2">{tela.caminho}</p>
          </Card>
        ))}
      </div>
    )
  },
  {
    numero: "04",
    titulo: "A planilha de leads",
    descricao: "Único ponto de entrada manual do fluxo — o formato das colunas importa.",
    conteudo: (
      <>
        <Card className="p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-2 font-medium">Coluna</th>
                <th className="px-4 py-2 font-medium">Conteúdo</th>
                <th className="px-4 py-2 font-medium">Obrigatório</th>
              </tr>
            </thead>
            <tbody>
              {PLANILHA.map((linha) => (
                <tr key={linha.coluna} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2 font-mono text-slate-700">{linha.coluna}</td>
                  <td className="px-4 py-2 text-slate-700">{linha.conteudo}</td>
                  <td className="px-4 py-2 text-slate-500">{linha.obrigatorio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="border-l-4 border-amber-400 bg-amber-50 rounded-r-md px-4 py-3 mt-4">
          <p className="text-xs font-mono uppercase tracking-wide text-amber-700 mb-1">Atenção</p>
          <p className="text-sm text-slate-700">Não apague nem edite manualmente o "enviado" da coluna H — isso faria o sistema enviar o e-mail de novo para aquele lead.</p>
        </div>
      </>
    )
  },
  {
    numero: "05",
    titulo: "Quando o lead responde",
    descricao: "A regra mais importante do sistema: ninguém recebe e-mail depois que responde.",
    conteudo: (
      <Card>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>• Resposta chega no Gmail conectado → sistema identifica pelo remetente e grava na Caixa de Entrada.</li>
          <li>• Sequência de remarketing daquele lead é interrompida na hora — nenhuma próxima etapa é agendada.</li>
          <li>• Status do lead muda para "Respondeu" e uma notificação (com som) avisa o responsável.</li>
          <li>• ChatGuru recebe a anotação da resposta automaticamente, pelo telefone do lead.</li>
          <li>• Dali em diante, o contato é manual — pela Caixa de Entrada ou pelo WhatsApp/ChatGuru.</li>
        </ul>
      </Card>
    )
  },
  {
    numero: "06",
    titulo: "Segurança dos disparos",
    descricao: "Proteções que já vêm ativas, mesmo com o envio automático ligado o tempo todo.",
    conteudo: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SEGURANCA.map((item) => (
          <Card key={item.titulo}>
            <p className="text-sm font-medium text-slate-800 mb-1">
              {item.icone} {item.titulo}
            </p>
            <p className="text-sm text-slate-500">{item.desc}</p>
          </Card>
        ))}
      </div>
    )
  },
  {
    numero: "07",
    titulo: "Checklist rápido",
    descricao: "Se algo parecer fora do ar.",
    conteudo: (
      <Card>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>
            <strong>Nenhum e-mail saindo?</strong> Veja em Automações se o último ciclo rodou nos últimos minutos.
          </li>
          <li>
            <strong>Lead novo na planilha não apareceu?</strong> Confira se a coluna H dele está mesmo vazia.
          </li>
          <li>
            <strong>Notificação sem som?</strong> O navegador só libera áudio depois do primeiro clique na página.
          </li>
          <li>
            <strong>Alguma tela pedindo login de novo?</strong> A sessão dura 30 dias — só acontece se o servidor tiver reiniciado.
          </li>
        </ul>
      </Card>
    )
  }
];

export default function ManualPage() {
  const [pagina, setPagina] = useState(0);
  const atual = PAGINAS[pagina];

  return (
    <div>
      <PageHeader
        titulo="Manual de Operação"
        descricao="Como o sistema funciona no dia a dia: o que roda sozinho, o que precisa de alguém, e onde olhar quando quiser conferir algo."
      />

      {/* Navegação por abas numeradas */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {PAGINAS.map((p, i) => (
          <button
            key={p.numero}
            onClick={() => setPagina(i)}
            className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              i === pagina ? "bg-brand-500 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {p.numero} · {p.titulo}
          </button>
        ))}
      </div>

      <section className="mb-6" style={{ minHeight: 420 }}>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          <span className="font-mono text-sm text-slate-400 mr-2">{atual.numero}</span>
          {atual.titulo}
        </h2>
        {atual.descricao && <p className="text-sm text-slate-500 mb-4 max-w-2xl">{atual.descricao}</p>}
        {atual.conteudo}
      </section>

      {/* Navegação anterior/próximo */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button
          disabled={pagina === 0}
          onClick={() => setPagina((p) => Math.max(0, p - 1))}
          className="text-sm px-4 py-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Anterior
        </button>
        <p className="text-xs text-slate-400">
          {pagina + 1} de {PAGINAS.length}
        </p>
        <button
          disabled={pagina === PAGINAS.length - 1}
          onClick={() => setPagina((p) => Math.min(PAGINAS.length - 1, p + 1))}
          className="text-sm px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
