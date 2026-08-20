"use client";
import { useRef, useState } from "react";

const EMOJIS = ["😀", "😊", "👍", "🙏", "✅", "⚠️", "📌", "📅", "📧", "📞", "💰", "⚖️", "🔒", "❗", "➡️", "🎯"];

/**
 * Editor de texto simples para os campos de e-mail (corpoHtml). Não usa
 * contentEditable/rich-text real — insere as tags HTML (<strong>, <em>, <u>)
 * diretamente ao redor do texto selecionado na textarea, e emojis no cursor.
 * O valor continua sendo HTML puro, igual ao que já era salvo antes.
 */
export default function RichTextEditor({
  value,
  onChange,
  rows = 10,
  placeholder
}: {
  value: string;
  onChange: (valor: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mostrarEmojis, setMostrarEmojis] = useState(false);

  function aplicarTag(tagAbre: string, tagFecha: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const inicio = ta.selectionStart;
    const fim = ta.selectionEnd;
    const selecionado = value.slice(inicio, fim) || "texto";
    const novoValor = value.slice(0, inicio) + tagAbre + selecionado + tagFecha + value.slice(fim);
    onChange(novoValor);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(inicio + tagAbre.length, inicio + tagAbre.length + selecionado.length);
    });
  }

  function inserirNoCursor(texto: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const inicio = ta.selectionStart;
    const fim = ta.selectionEnd;
    const novoValor = value.slice(0, inicio) + texto + value.slice(fim);
    onChange(novoValor);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(inicio + texto.length, inicio + texto.length);
    });
    setMostrarEmojis(false);
  }

  function novoParagrafo() {
    inserirNoCursor("\n\n<p></p>");
  }

  return (
    <div className="border border-slate-300 rounded-md overflow-hidden">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1 relative">
        <button type="button" title="Negrito" onClick={() => aplicarTag("<strong>", "</strong>")} className="w-7 h-7 text-sm font-bold rounded hover:bg-slate-200">
          B
        </button>
        <button type="button" title="Itálico" onClick={() => aplicarTag("<em>", "</em>")} className="w-7 h-7 text-sm italic rounded hover:bg-slate-200">
          I
        </button>
        <button type="button" title="Sublinhado" onClick={() => aplicarTag("<u>", "</u>")} className="w-7 h-7 text-sm underline rounded hover:bg-slate-200">
          U
        </button>
        <button type="button" title="Novo parágrafo" onClick={novoParagrafo} className="px-2 h-7 text-xs rounded hover:bg-slate-200">
          ¶
        </button>
        <div className="relative">
          <button type="button" title="Emoji" onClick={() => setMostrarEmojis((v) => !v)} className="w-7 h-7 text-sm rounded hover:bg-slate-200">
            😀
          </button>
          {mostrarEmojis && (
            <div className="absolute z-10 top-8 left-0 bg-white border border-slate-200 rounded-md shadow-md p-2 grid grid-cols-8 gap-1 w-64">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => inserirNoCursor(e)} className="text-lg hover:bg-slate-100 rounded">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="ml-auto text-[11px] text-slate-400 pr-1">HTML — use as tags no texto</span>
      </div>
      <textarea
        ref={textareaRef}
        className="w-full px-3 py-2 text-sm font-mono outline-none"
        style={{ minHeight: `${rows * 1.4}rem` }}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
