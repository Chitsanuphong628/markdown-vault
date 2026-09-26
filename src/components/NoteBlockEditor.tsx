"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import hljs from "highlight.js/lib/common";
import { AlertCircle, Check, Code2, Copy, Image as ImageIcon, Pencil, Plus, RotateCcw } from "lucide-react";
import { I18N_DIAGRAM, type Language } from "@/lib/i18n";
import { parseGfmAlert } from "@/lib/gfmAlerts";
import { GfmAlertCard } from "@/components/GfmAlertCard";

const MermaidChart = dynamic(() => import("@/components/MermaidChart"), { ssr: false });
type LocalizedNodeViewProps = NodeViewProps & { lang: Language };

export function OpaqueMarkdownView({ node, updateAttributes, lang, editor, getPos }: LocalizedNodeViewProps) {
  const markdown = String(node.attrs.markdown || "");
  const alert = parseGfmAlert(markdown);
  const [editing, setEditing] = useState(false);

  const continueBelow = () => {
    const position = getPos();
    if (typeof position !== "number") return;
    const paragraphPosition = position + node.nodeSize;

    editor.chain()
      .focus()
      .insertContentAt(paragraphPosition, { type: "paragraph" })
      .setTextSelection(paragraphPosition + 1)
      .run();
  };

  return (
    <NodeViewWrapper className={alert ? "my-3" : "my-3 rounded-md border border-neutral-800 bg-neutral-900/50 p-3"} contentEditable={false}>
      {alert && <GfmAlertCard type={alert.type} body={alert.body} lang={lang} />}
      <div className={`flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400${alert ? " px-1" : ""}`}>
        {!alert && <span className="inline-flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5" />
          <span>{lang === "th" ? "เก็บเนื้อหาส่วนนี้ไว้ตามเดิม" : "This section is kept as written"}</span>
        </span>}
        <span className="flex flex-wrap items-center gap-1">
          <button type="button" onMouseDown={event => event.preventDefault()} onClick={continueBelow} className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">
            <Plus className="h-3.5 w-3.5" />{lang === "th" ? "เขียนต่อด้านล่าง" : "Write below"}
          </button>
          <button type="button" aria-expanded={editing} onMouseDown={event => event.preventDefault()} onClick={() => setEditing(value => !value)} className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">
            <Pencil className="h-3.5 w-3.5" />{editing
              ? (lang === "th" ? "ปิดตัวแก้ไข" : "Close editor")
              : alert
                ? (lang === "th" ? "แก้ข้อความเตือน" : "Edit alert")
                : (lang === "th" ? "แก้ส่วนนี้เป็น Markdown" : "Edit this part as Markdown")}
          </button>
        </span>
      </div>
      {editing ? (
        <textarea
          aria-label={lang === "th" ? "ต้นฉบับ Markdown" : "Markdown source"}
          value={markdown}
          onChange={event => updateAttributes({ markdown: event.target.value })}
          spellCheck={false}
          className="mt-2 min-h-20 w-full resize-y rounded border border-neutral-700 bg-neutral-950 p-2 font-mono text-xs leading-5 text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        />
      ) : !alert ? (
        <p className="mt-2 max-h-16 overflow-hidden whitespace-pre-wrap break-words text-xs leading-5 text-neutral-500">{markdown}</p>
      ) : null}
    </NodeViewWrapper>
  );
}

export function FootnoteReferenceView({ node, lang }: LocalizedNodeViewProps) {
  return (
    <NodeViewWrapper as="span" contentEditable={false} className="align-super rounded px-0.5 text-xs text-indigo-300" title={lang === "th" ? `เชิงอรรถ ${node.attrs.label}` : `Footnote ${node.attrs.label}`}>
      {String(node.attrs.label || "")}
    </NodeViewWrapper>
  );
}

export function FootnoteDefinitionView({ node, updateAttributes, lang }: LocalizedNodeViewProps) {
  const [editing, setEditing] = useState(false);
  const label = String(node.attrs.label || "");
  const text = String(node.attrs.text || "");

  return (
    <NodeViewWrapper className="my-2 rounded border-l-2 border-neutral-700 pl-3" contentEditable={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>{lang === "th" ? `เชิงอรรถ ${label}` : `Footnote ${label}`}</span>
        <button type="button" aria-expanded={editing} onMouseDown={event => event.preventDefault()} onClick={() => setEditing(value => !value)} className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">
          <Pencil className="h-3.5 w-3.5" />{editing
            ? (lang === "th" ? "ปิดตัวแก้ไข" : "Close editor")
            : (lang === "th" ? "แก้ข้อความ" : "Edit text")}
        </button>
      </div>
      {editing ? (
        <textarea aria-label={lang === "th" ? `ข้อความเชิงอรรถ ${label}` : `Footnote ${label} text`} value={text} onChange={event => updateAttributes({ text: event.target.value })} className="mt-1 min-h-16 w-full resize-y rounded border border-neutral-700 bg-neutral-950 p-2 text-sm leading-6 text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" />
      ) : (
        <p className="py-1 text-sm leading-6 text-neutral-300">{text}</p>
      )}
    </NodeViewWrapper>
  );
}

export function MathBlockView({ node, updateAttributes, lang }: LocalizedNodeViewProps) {
  const latex = String(node.attrs.latex || "");
  const [editing, setEditing] = useState(false);
  const html = useMemo(() => katex.renderToString(latex, { displayMode: true, throwOnError: false }), [latex]);

  return (
    <NodeViewWrapper className="my-4 rounded-md border border-neutral-800 bg-neutral-900/60 p-3" contentEditable={false}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-neutral-400">
        <span>{lang === "th" ? "สูตร" : "Formula"}</span>
        <button type="button" aria-expanded={editing} onClick={() => setEditing(value => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">
          {editing ? <RotateCcw className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {editing ? (lang === "th" ? "ดูสูตร" : "View formula") : (lang === "th" ? "แก้สูตร" : "Edit formula")}
        </button>
      </div>
      {editing ? (
        <textarea aria-label={lang === "th" ? "สูตร LaTeX" : "LaTeX formula source"} value={latex} onChange={event => updateAttributes({ latex: event.target.value })} className="min-h-20 w-full resize-y rounded border border-neutral-700 bg-neutral-950 p-2 font-mono text-sm text-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" />
      ) : (
        <div className="overflow-x-auto py-2 text-neutral-100" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </NodeViewWrapper>
  );
}

export function InlineMathView({ node, updateAttributes, lang }: LocalizedNodeViewProps) {
  const latex = String(node.attrs.latex || "");
  const [editing, setEditing] = useState(false);
  const html = useMemo(() => katex.renderToString(latex, { throwOnError: false }), [latex]);

  if (editing) {
    return (
      <NodeViewWrapper as="span" contentEditable={false} className="inline-flex align-middle">
        <input aria-label={lang === "th" ? "สูตร LaTeX ในบรรทัด" : "Inline LaTeX formula"} autoFocus value={latex} onChange={event => updateAttributes({ latex: event.target.value })} onBlur={() => setEditing(false)} className="w-36 rounded border border-indigo-500 bg-neutral-950 px-1 font-mono text-xs text-neutral-100 outline-none" />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" contentEditable={false} className="inline-flex cursor-pointer align-middle rounded px-0.5 hover:bg-neutral-800 focus-within:ring-2 focus-within:ring-indigo-400" onClick={() => setEditing(true)} title={lang === "th" ? "แก้สูตร" : "Edit formula"}>
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </NodeViewWrapper>
  );
}

export function NoteImageView({ node, updateAttributes, lang }: LocalizedNodeViewProps) {
  const [editing, setEditing] = useState(false);
  const src = String(node.attrs.src || "");
  const alt = String(node.attrs.alt || "");
  let safeSrc = "";
  try {
    const url = new URL(src);
    if (url.protocol === "https:" || url.protocol === "http:") safeSrc = url.href;
  } catch { /* Show the source field for invalid or relative image URLs. */ }

  return (
    <NodeViewWrapper as="span" className="my-3 inline-flex max-w-full flex-col items-start gap-1 align-middle" contentEditable={false}>
      {safeSrc ? (
        // Remote images stay at their source; only the URL is saved in the note.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeSrc} alt={alt} loading="lazy" referrerPolicy="no-referrer" className="max-h-[70vh] max-w-full rounded border border-neutral-800" />
      ) : <span className="inline-flex items-center gap-2 rounded border border-neutral-700 px-3 py-2 text-xs text-neutral-400"><ImageIcon className="h-4 w-4" />{lang === "th" ? "URL รูปภาพไม่ถูกต้อง" : "Invalid image URL"}</span>}
      {editing ? (
        <span className="flex max-w-full flex-wrap gap-1.5">
          <input aria-label={lang === "th" ? "URL รูปภาพ" : "Image URL"} value={src} onChange={event => updateAttributes({ src: event.target.value })} className="min-h-10 w-64 max-w-full rounded border border-neutral-700 bg-neutral-950 px-2 text-xs text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" />
          <input aria-label={lang === "th" ? "คำอธิบายภาพ" : "Image description"} value={alt} onChange={event => updateAttributes({ alt: event.target.value })} placeholder={lang === "th" ? "คำอธิบายภาพ" : "Describe the image"} className="min-h-10 w-40 max-w-full rounded border border-neutral-700 bg-neutral-950 px-2 text-xs text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" />
          <button type="button" onClick={() => setEditing(false)} className="min-h-10 rounded px-2 text-xs text-neutral-300 hover:bg-neutral-800">{lang === "th" ? "เสร็จ" : "Done"}</button>
        </span>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-indigo-400"><Pencil className="h-3.5 w-3.5" />{lang === "th" ? "แก้ URL" : "Edit URL"}</button>
      )}
    </NodeViewWrapper>
  );
}

export function CodeBlockView({ node, lang }: LocalizedNodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const isMermaid = String(node.attrs.language || "").toLowerCase() === "mermaid";
  const language = String(node.attrs.language || "").trim().toLowerCase();
  const source = node.textContent;
  const highlightedCode = useMemo(() => {
    try {
      return language && hljs.getLanguage(language)
        ? hljs.highlight(source, { language, ignoreIllegals: true }).value
        : hljs.highlightAuto(source).value;
    } catch {
      return source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
    }
  }, [language, source]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <NodeViewWrapper className="my-4 overflow-hidden rounded-md border border-neutral-800 bg-[#15171d]">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5 font-mono text-xs text-neutral-400">
        <span>{String(node.attrs.language || "text")}</span>
        <div className="flex items-center gap-1">
          <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => void handleCopy()} disabled={!source} title={copyFailed ? I18N_DIAGRAM[lang].copyFailed : I18N_DIAGRAM[lang].copy} aria-label={copyFailed ? I18N_DIAGRAM[lang].copyFailed : (lang === "th" ? "คัดลอกโค้ด" : "Copy code")} className="inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-indigo-400">
            {copied ? <Check className="h-3.5 w-3.5" /> : copyFailed ? <AlertCircle className="h-3.5 w-3.5 text-rose-300" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? (lang === "th" ? "คัดลอกแล้ว" : "Copied") : (lang === "th" ? "คัดลอก" : "Copy")}</span>
          </button>
          <button type="button" aria-expanded={editing} onMouseDown={event => event.preventDefault()} onClick={() => setEditing(value => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">
            <Pencil className="h-3.5 w-3.5" />{editing
              ? (isMermaid ? (lang === "th" ? "ดูแผนภาพ" : "View diagram") : (lang === "th" ? "ดูโค้ด" : "View code"))
              : (isMermaid ? (lang === "th" ? "แก้ Mermaid" : "Edit Mermaid") : (lang === "th" ? "แก้โค้ด" : "Edit code"))}
          </button>
        </div>
      </div>
      {copyFailed && <p role="status" className="sr-only">{I18N_DIAGRAM[lang].copyFailed}</p>}
      {editing ? (
        <NodeViewContent className="min-h-12 overflow-x-auto whitespace-pre-wrap p-3 font-mono text-sm leading-6 outline-none" />
      ) : isMermaid && source.trim() ? (
        <div className="max-h-[32rem] overflow-auto p-2"><MermaidChart lang={lang} chart={source} /></div>
      ) : source ? (
        <pre className="max-h-[32rem] overflow-auto p-3 text-sm leading-6"><code className={`hljs language-${language || "text"}`} dangerouslySetInnerHTML={{ __html: highlightedCode }} /></pre>
      ) : (
        <div className="px-3 py-4 text-xs text-neutral-500">{lang === "th" ? "ยังไม่มีโค้ด" : "No code"}</div>
      )}
    </NodeViewWrapper>
  );
}
