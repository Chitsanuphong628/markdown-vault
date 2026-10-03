"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, isolateHistory } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput } from "@codemirror/language";
import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { editMarkdownSelection, type MarkdownAction } from "../../shared/markdownEditing";
import { convertHtmlToMarkdown, escapeMarkdownText } from "../../shared/htmlToMarkdown";
import { parseNoteTheme } from "../../shared/noteTheme";
import { externalSourceUpdate, getMarkdownSource, markdownSource, minimalTextChange, replaceMarkdownSource, sourceHistory } from "../markdownSource";
import { livePreview, setSourceView, sourceViewField } from "../livePreviewExtension";
import type { Language } from "@/shared/language";

export interface UnifiedNoteEditorHandle {
  getMarkdown: () => string;
  insertText: (text: string) => void;
  insertMarkdown: (markdown: string) => void;
  openFind: () => void;
  toggleSource: () => void;
}
interface UnifiedNoteEditorProps {
  noteId: string;
  value: string;
  onChange: (value: string) => void;
  lang: Language;
  autoFocus?: boolean;
  onOpenDiagram: () => void;
}
const ACTIONS: Array<{ action: MarkdownAction; label: string; th: string; en: string }> = [
  { action: "heading", label: "H", th: "หัวข้อ", en: "Heading" },
  { action: "bold", label: "B", th: "ตัวหนา", en: "Bold" },
  { action: "italic", label: "I", th: "ตัวเอียง", en: "Italic" },
  { action: "strike", label: "S̶", th: "ขีดฆ่า", en: "Strikethrough" },
  { action: "bullet", label: "•", th: "รายการ", en: "Bullet list" },
  { action: "numbered", label: "1.", th: "ลำดับเลข", en: "Numbered list" },
  { action: "task", label: "☐", th: "เช็กลิสต์", en: "Checklist" },
  { action: "quote", label: "❝", th: "คำอ้างอิง", en: "Quote" },
  { action: "link", label: "↗", th: "ลิงก์", en: "Link" },
  { action: "image", label: "▧", th: "รูปภาพ", en: "Image" },
  { action: "table", label: "▦", th: "ตาราง", en: "Table" },
  { action: "code", label: "<>", th: "โค้ด", en: "Inline code" },
  { action: "codeBlock", label: "{ }", th: "โค้ดบล็อก", en: "Code block" },
  { action: "math", label: "$x$", th: "สูตรในบรรทัด", en: "Inline math" },
  { action: "mathBlock", label: "∑", th: "สูตรคณิตศาสตร์", en: "Math block" },
];
const editorTheme = EditorView.theme({
  "&": { height: "100%", color: "#e5e5e5", backgroundColor: "transparent", fontSize: "15px" },
  ".cm-scroller": { overflow: "auto", fontFamily: "inherit", lineHeight: "1.8" },
  ".cm-content": { padding: "20px 0 180px", caretColor: "#c7d2fe", minHeight: "360px" },
  ".cm-line": { padding: "0 20px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#c7d2fe" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "#4338ca66" },
  ".cm-panels": { backgroundColor: "#171717", color: "#e5e5e5" },
  ".cm-textfield, .cm-button": { background: "#262626", color: "#e5e5e5", border: "1px solid #525252", borderRadius: "4px" },
  ".cm-md-heading": { fontWeight: "700", lineHeight: "1.5", paddingTop: "12px", paddingBottom: "8px" },
  ".cm-md-h1": { fontSize: "1.9em" }, ".cm-md-h2": { fontSize: "1.5em" }, ".cm-md-h3": { fontSize: "1.25em" },
  ".cm-md-strong": { fontWeight: "700" }, ".cm-md-emphasis": { fontStyle: "italic" }, ".cm-md-delete": { textDecoration: "line-through" },
  ".cm-md-inlineCode": { fontFamily: "monospace", color: "#f9a8d4", background: "#262626", borderRadius: "3px" },
  ".cm-md-quote": { borderLeft: "2px solid #525252", color: "#a3a3a3", marginLeft: "20px", paddingLeft: "12px" },
  ".cm-md-block": { margin: "8px 20px", overflowX: "auto", cursor: "text" },
  ".cm-md-block:focus-visible, .cm-md-inline-widget:focus-visible": { outline: "2px solid #818cf8" },
  ".cm-md-inline-widget, .cm-md-inline-widget p": { display: "inline", margin: "0" },
  ".cm-md-inline-widget img": { display: "inline-block", maxHeight: "120px" },
  ".cm-md-task": { accentColor: "#818cf8", margin: "0 4px", cursor: "pointer", verticalAlign: "middle" },
  ".cm-placeholder": { color: "#737373" },
}, { dark: true });

const UnifiedNoteEditor = forwardRef<UnifiedNoteEditorHandle, UnifiedNoteEditorProps>(function UnifiedNoteEditor(
  { noteId, value, onChange, lang, autoFocus = false, onOpenDiagram }, ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const propsRef = useRef({ value, onChange, lang, autoFocus });
  const previewCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());
  const [sourceView, setSourceViewState] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { propsRef.current = { value, onChange, lang, autoFocus }; });

  const insertMarkdown = (text: string) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ ...view.state.replaceSelection(text.replace(/\r\n?/g, "\n")), annotations: [Transaction.userEvent.of("input"), isolateHistory.of("full")], scrollIntoView: true });
    view.focus();
  };
  const toggleSource = () => {
    const view = viewRef.current;
    if (!view) return;
    const next = !view.state.field(sourceViewField);
    const scrollTop = view.scrollDOM.scrollTop;
    const scrollLeft = view.scrollDOM.scrollLeft;
    view.dispatch({ effects: setSourceView.of(next) });
    setSourceViewState(next);
    view.focus();
    requestAnimationFrame(() => { if (viewRef.current === view) { view.scrollDOM.scrollTop = scrollTop; view.scrollDOM.scrollLeft = scrollLeft; } });
  };
  const format = (action: MarkdownAction) => {
    const view = viewRef.current;
    if (!view) return;
    const source = view.state.doc.toString();
    const { from, to } = view.state.selection.main;
    let url: string | undefined;
    if (action === "link" || action === "image") {
      const entered = window.prompt(propsRef.current.lang === "th" ? "URL แบบ HTTPS" : "HTTPS URL", "https://");
      if (entered === null) return;
      url = entered;
    }
    try {
      const edited = editMarkdownSelection(source, from, to, action, url);
      view.dispatch({ changes: minimalTextChange(source, edited.text), selection: { anchor: edited.selectionStart, head: edited.selectionEnd }, annotations: [Transaction.userEvent.of("input"), isolateHistory.of("full")], scrollIntoView: true });
      view.focus();
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid URL"); }
  };
  useImperativeHandle(ref, () => ({
    getMarkdown: () => viewRef.current ? getMarkdownSource(viewRef.current.state) : propsRef.current.value,
    insertText: text => insertMarkdown(escapeMarkdownText(text)),
    insertMarkdown,
    openFind: () => { if (viewRef.current) openSearchPanel(viewRef.current); },
    toggleSource,
  }));

  useEffect(() => {
    if (!hostRef.current) return;
    const initial = propsRef.current;
    const normalized = initial.value.replace(/\r\n?/g, "\n");
    const start = normalized.length - parseNoteTheme(normalized).cleanContent.length;
    let plainPaste = false;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: normalized,
        selection: { anchor: Math.min(start, normalized.length) },
        extensions: [
          markdownSource(initial.value), history(), sourceHistory,
          markdown(), syntaxHighlighting(defaultHighlightStyle), indentOnInput(),
          previewCompartment.current.of(livePreview(initial.lang)),
          EditorView.lineWrapping, editorTheme, search({ top: true }),
          languageCompartment.current.of([
            placeholder(initial.lang === "th" ? "เริ่มเขียนโน้ต…" : "Start writing…"),
            EditorView.contentAttributes.of({ "aria-label": initial.lang === "th" ? "เนื้อหาโน้ต" : "Note content", "data-note-id": noteId, spellcheck: "true" }),
          ]),
          keymap.of([
            { key: "Mod-b", run: () => { format("bold"); return true; } },
            { key: "Mod-i", run: () => { format("italic"); return true; } },
            ...defaultKeymap, ...historyKeymap, ...searchKeymap,
          ]),
          EditorView.domEventObservers({
            keydown(event) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") plainPaste = event.shiftKey; },
            keyup() { plainPaste = false; },
          }),
          EditorView.domEventHandlers({
            paste(event, editor) {
              const data = event.clipboardData;
              if (!data) return false;
              const html = data.getData("text/html");
              const text = !plainPaste && html ? convertHtmlToMarkdown(html) ?? data.getData("text/plain") : data.getData("text/plain");
              plainPaste = false;
              if (!text && !html) return false;
              event.preventDefault();
              editor.dispatch({ ...editor.state.replaceSelection(text.replace(/\r\n?/g, "\n")), annotations: [Transaction.userEvent.of("input.paste"), isolateHistory.of("full")], scrollIntoView: true });
              return true;
            },
          }),
          EditorView.updateListener.of(update => {
            if (update.docChanged && !update.transactions.some(transaction => transaction.annotation(externalSourceUpdate))) propsRef.current.onChange(getMarkdownSource(update.state));
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (initial.autoFocus) view.focus();
    const openFind = () => openSearchPanel(view);
    window.addEventListener("nota:open-find", openFind);
    return () => { window.removeEventListener("nota:open-find", openFind); viewRef.current = null; view.destroy(); };
    // The note owns one editor instance; external values are applied as transactions below.
  }, [noteId]);

  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== getMarkdownSource(view.state)) view.dispatch(replaceMarkdownSource(view.state, value));
  }, [value]);
  useEffect(() => {
    viewRef.current?.dispatch({ effects: [
      previewCompartment.current.reconfigure(livePreview(lang)),
      languageCompartment.current.reconfigure([
        placeholder(lang === "th" ? "เริ่มเขียนโน้ต…" : "Start writing…"),
        EditorView.contentAttributes.of({ "aria-label": lang === "th" ? "เนื้อหาโน้ต" : "Note content", "data-note-id": noteId, spellcheck: "true" }),
      ]),
    ] });
  }, [lang, noteId]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/50" data-editor="unified">
      <div role="toolbar" aria-label={lang === "th" ? "จัดรูปแบบโน้ต" : "Note formatting"} className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-800 p-1.5">
        {ACTIONS.map(({ action, label, th, en }) => <button key={action} type="button" title={lang === "th" ? th : en} aria-label={lang === "th" ? th : en} onMouseDown={event => event.preventDefault()} onClick={() => format(action)} className="min-h-9 min-w-9 shrink-0 rounded px-2 text-xs text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">{label}</button>)}
        <button type="button" onMouseDown={event => event.preventDefault()} onClick={onOpenDiagram} className="min-h-9 shrink-0 rounded px-2 text-xs text-neutral-300 hover:bg-neutral-800">{lang === "th" ? "แผนภาพ" : "Diagram"}</button>
        <button type="button" aria-pressed={sourceView} onClick={toggleSource} className="ml-auto min-h-9 shrink-0 rounded border border-neutral-700 px-2.5 text-xs text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">{sourceView ? "Live Preview" : lang === "th" ? "ต้นฉบับ Markdown" : "Markdown source"}</button>
      </div>
      {error && <p role="alert" className="px-3 py-2 text-xs text-rose-300">{error}</p>}
      <div ref={hostRef} className="min-h-0 min-w-0 flex-1 overflow-hidden" />
    </div>
  );
});
export default UnifiedNoteEditor;
