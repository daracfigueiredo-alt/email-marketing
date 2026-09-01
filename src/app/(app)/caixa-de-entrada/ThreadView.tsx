"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RichTextEditor from "@/components/RichTextEditor";
import { personalizarTexto } from "@/lib/personalizacao";

interface ModeloEmail {
  id: string;
  nome: string;
  assunto: string;
  corpoHtml: string;
  anexos?: { nome: string; url?: string; tipo?: string; tamanho?: number }[] | null;
}

interface Mensagem {
  id: string;
  direcao: "ENVIADA" | "RECEBIDA";
  assunto: string | null;
  corpo: string;
  cc: string | null;
  cco: string | null;
  rascunho: boolean;
  anexos?: { nome: string; url?: string }[] | null;
  criadoEm: string | Date;
  usuario?: { nome: string } | null;
  visualizadaEm?: string | Date | null;
  editadoEm?: string | Date | null;
}

/** ✓✓ estilo WhatsApp: cinza = enviado, azul = visualizado (via pixel — não é garantia, o cliente do lead pode bloquear imagem remota). */
function StatusVisualizacao({ visualizadaEm }: { visualizadaEm?: string | Date | null }) {
  return (
    <span title={visualizadaEm ? `Visualizado em ${new Date(visualizadaEm).toLocaleString("pt-BR")}` : "Enviado, ainda não visualizado"} className={`text-xs ${visualizadaEm ? "text-blue-500" : "text-slate-400"}`}>
      ✓✓
    </span>
  );
}

function MensagemCorrecao({ mensagem, onSalvo }: { mensagem: Mensagem; onSalvo: () => void }) {
  const [assunto, setAssunto] = useState(mensagem.assunto || "");
  const [corpo, setCorpo] = useState(mensagem.corpo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/mensagens/${mensagem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assunto, corpo })
      });
      if (!resp.ok) throw new Error("Falha ao corrigir registro");
      onSalvo();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <input className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto" />
      <RichTextEditor value={corpo} onChange={setCorpo} rows={5} />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button disabled={salvando} onClick={salvar} className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1 disabled:opacity-60">
          {salvando ? "Salvando..." : "Salvar correção"}
        </button>
        <button disabled={salvando} onClick={onSalvo} className="text-xs text-slate-500 hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function ThreadView({
  lead,
  thread,
  modelos
}: {
  lead: { id: string; nome: string; email: string | null; empresa: string | null; telefone: string | null; responsavel?: { nome: string } | null };
  thread: Mensagem[];
  modelos: ModeloEmail[];
}) {
  const router = useRouter();
  const [modo, setModo] = useState<null | "responder" | "encaminhar">(null);
  const [enviandoModelo, setEnviandoModelo] = useState(false);
  const [erroModelo, setErroModelo] = useState<string | null>(null);

  async function enviarModelo(modeloId: string) {
    const modelo = modelos.find((m) => m.id === modeloId);
    if (!modelo) return;
    setEnviandoModelo(true);
    setErroModelo(null);
    try {
      const dadosPersonalizacao = { nome: lead.nome, empresa: lead.empresa, email: lead.email, telefone: lead.telefone, responsavel: lead.responsavel?.nome };
      const resp = await fetch(`/api/leads/${lead.id}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assunto: personalizarTexto(modelo.assunto, dadosPersonalizacao),
          corpo: personalizarTexto(modelo.corpoHtml, dadosPersonalizacao),
          anexos: modelo.anexos || undefined,
          rascunho: false
        })
      });
      if (!resp.ok) {
        const dados = await resp.json().catch(() => ({}));
        throw new Error(dados.erro || "Falha ao enviar modelo");
      }
      router.refresh();
    } catch (err: any) {
      setErroModelo(err.message);
    } finally {
      setEnviandoModelo(false);
    }
  }
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [cc, setCc] = useState("");
  const [cco, setCco] = useState("");
  const [mostrarCc, setMostrarCc] = useState(false);
  const [mostrarCco, setMostrarCco] = useState(false);
  const [anexos, setAnexos] = useState<{ nome: string; url?: string; tipo?: string; tamanho?: number }[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [corrigindoId, setCorrigindoId] = useState<string | null>(null);

  async function handleAnexar(arquivo: File) {
    setEnviandoAnexo(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const resp = await fetch("/api/anexos", { method: "POST", body: fd });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || "Falha ao enviar anexo");
      setAnexos((atual) => [...atual, dados]);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function enviar(rascunho = false) {
    setEnviando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/leads/${lead.id}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assunto, corpo, cc: cc || undefined, cco: cco || undefined, anexos, rascunho })
      });
      if (!resp.ok) throw new Error("Falha ao enviar mensagem");
      setModo(null);
      setCorpo("");
      setCc("");
      setCco("");
      setAnexos([]);
      router.refresh();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{lead.nome}</h2>
          <p className="text-sm text-slate-500">{lead.email}</p>
        </div>
        <Link href={`/leads/${lead.id}`} className="text-xs text-brand-600 hover:underline">
          Ver ficha do lead
        </Link>
      </div>

      <div className="space-y-3 mb-6">
        {thread.map((m) => (
          <div key={m.id} className={`p-3 rounded-md text-sm bg-white border ${m.direcao === "RECEBIDA" ? "border-amber-200" : "border-slate-200"}`}>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>
                {m.direcao === "ENVIADA" ? `Enviada${m.usuario ? " por " + m.usuario.nome : ""}` : "Recebida do lead"}
                {m.rascunho ? " · rascunho" : ""}
                {m.assunto ? ` · ${m.assunto}` : ""}
                {m.editadoEm ? " · registro corrigido" : ""}
              </span>
              <span className="flex items-center gap-2">
                {new Date(m.criadoEm).toLocaleString("pt-BR")}
                {m.direcao === "ENVIADA" && !m.rascunho && <StatusVisualizacao visualizadaEm={m.visualizadaEm} />}
              </span>
            </div>
            {(m.cc || m.cco) && (
              <p className="text-xs text-slate-400 mb-1">
                {m.cc && <>Cc: {m.cc} </>}
                {m.cco && <>Cco: {m.cco}</>}
              </p>
            )}
            {corrigindoId === m.id ? (
              <MensagemCorrecao mensagem={m} onSalvo={() => { setCorrigindoId(null); router.refresh(); }} />
            ) : (
              <>
                {m.direcao === "ENVIADA" ? (
                  // Mensagens que nós enviamos são HTML de verdade (modelos com <strong>, <p> etc.
                  // já sanitizados na origem — ver escaparHtml em personalizacao.ts). Respostas
                  // recebidas do lead (abaixo) continuam como texto puro por segurança.
                  <div className="text-slate-700 [&_p]:mb-2 [&_a]:text-brand-600 [&_a]:underline" dangerouslySetInnerHTML={{ __html: m.corpo }} />
                ) : (
                  <p className="text-slate-700 whitespace-pre-wrap">{m.corpo}</p>
                )}
                {m.direcao === "ENVIADA" && (
                  <button onClick={() => setCorrigindoId(m.id)} className="text-xs text-brand-600 hover:underline mt-1">
                    Corrigir registro
                  </button>
                )}
              </>
            )}
            {m.anexos && m.anexos.length > 0 && (
              <ul className="mt-2 text-xs text-brand-600 space-y-1">
                {m.anexos.map((a, i) => (
                  <li key={i}>
                    {a.url ? (
                      <a href={a.url} className="hover:underline">
                        📎 {a.nome}
                      </a>
                    ) : (
                      <span className="text-slate-400">📎 {a.nome}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {thread.length === 0 && <p className="text-sm text-slate-400">Nenhuma mensagem ainda.</p>}
      </div>

      {!modo && (
        <div className="space-y-4">
          {modelos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">
                ✉️ Enviar modelo{!lead.email && " (lead sem e-mail cadastrado)"} — clique para enviar na hora:
              </p>
              <div className="flex flex-wrap gap-2">
                {modelos.map((m) => (
                  <button
                    key={m.id}
                    disabled={enviandoModelo || !lead.email}
                    onClick={() => enviarModelo(m.id)}
                    title={!lead.email ? "Lead sem e-mail cadastrado" : `Assunto: ${m.assunto}`}
                    className="text-left border border-slate-300 rounded-md px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed max-w-xs"
                  >
                    <div className="text-sm font-medium text-slate-800">{m.nome}</div>
                    <div className="text-xs text-slate-500 truncate">{m.assunto}</div>
                  </button>
                ))}
              </div>
              {enviandoModelo && <p className="text-xs text-slate-500 mt-2">Enviando...</p>}
              {erroModelo && <p className="text-xs text-red-600 mt-2">{erroModelo}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setModo("responder")} className="text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2">
              RESPONDER
            </button>
            <button onClick={() => setModo("encaminhar")} className="text-sm border border-slate-300 rounded-md px-4 py-2 hover:bg-slate-50">
              ENCAMINHAR
            </button>
          </div>
        </div>
      )}

      {modo && (
        <div className="bg-white border border-slate-200 rounded-md p-4">
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-2"
            placeholder="Assunto"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
          />
          <div className="flex gap-3 mb-2 text-xs">
            <button type="button" onClick={() => setMostrarCc(!mostrarCc)} className="text-brand-600 hover:underline">
              Cc
            </button>
            <button type="button" onClick={() => setMostrarCco(!mostrarCco)} className="text-brand-600 hover:underline">
              Cco
            </button>
          </div>
          {mostrarCc && (
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-2" placeholder="Cópia para" value={cc} onChange={(e) => setCc(e.target.value)} />
          )}
          {mostrarCco && (
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-2" placeholder="Cópia oculta para" value={cco} onChange={(e) => setCco(e.target.value)} />
          )}
          <div className="mb-2">
            <RichTextEditor
              value={corpo}
              onChange={setCorpo}
              rows={6}
              placeholder={modo === "encaminhar" ? "Mensagem adicional..." : "Sua resposta..."}
            />
          </div>
          <div className="mb-2">
            <label className="text-xs text-slate-500">
              Anexar arquivo (PDF, DOCX, XLSX, JPG, PNG e outros)
              <input
                type="file"
                disabled={enviandoAnexo}
                className="block text-xs mt-1"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) handleAnexar(arquivo);
                  e.target.value = "";
                }}
              />
            </label>
            {enviandoAnexo && <p className="text-xs text-slate-400 mt-1">Enviando anexo...</p>}
            {anexos.length > 0 && (
              <ul className="text-xs text-slate-500 mt-1 list-disc list-inside">
                {anexos.map((a, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span>{a.nome}</span>
                    <button type="button" onClick={() => setAnexos(anexos.filter((_, idx) => idx !== i))} className="text-red-500 hover:underline">
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {erro && <p className="text-sm text-red-600 mb-2">{erro}</p>}

          <div className="flex gap-2">
            <button disabled={enviando || enviandoAnexo} onClick={() => enviar(false)} className="text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 disabled:opacity-60">
              Enviar
            </button>
            <button disabled={enviando || enviandoAnexo} onClick={() => enviar(true)} className="text-sm border border-slate-300 rounded-md px-4 py-2 hover:bg-slate-50">
              Salvar rascunho
            </button>
            <button disabled={enviando} onClick={() => setModo(null)} className="text-sm text-slate-500 hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
