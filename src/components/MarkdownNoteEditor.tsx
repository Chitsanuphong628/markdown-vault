"use client";

import { forwardRef, useDeferredValue, useImperativeHandle, useRef, useState } from "react";
import MarkdownViewer from "@/components/MarkdownViewer";
import { editMarkdownSelection, type MarkdownAction } from "@/lib/markdownEditing";
import type { Language } from "@/lib/i18n";

export interface MarkdownNoteEditorHandle {
  insertMarkdown: (markdown: string) => void;
}

interface MarkdownNoteEditorProps {
  noteId: string;
  value: string;
  onChange: (value: string) => void;
  lang: Language;
}

const ACTIONS: Array<{ action: MarkdownAction; label: string; hint: string }> = [
  { action: "heading", label: "H2", hint: "Heading" },
  { action: "bold", label: "B", hint: "Bold" },
  { action: "italic", label: "I", hint: "Italic" },
  { action: "strike", label: "S̶", hint: "Strikethrough" },
  { action: "bullet", label: "• List", hint: "Bullet list" },
  { action: "numbered", label: "1. List", hint: "Numbered list" },
  { action: "task", label: "☐ Task", hint: "Checklist" },
  { action: "quote", label: "❝", hint: "Quote" },
  { action: "link", label: "Link", hint: "Link URL" },
  { action: "image", label: "Image", hint: "Image URL" },
  { action: "table", label: "Table", hint: "Table" },
  { action: "code", label: "`code`", hint: "Inline code" },
  { action: "codeBlock", label: "Code block", hint: "Code block" },
  { action: "math", label: "$x$", hint: "Inline math" },
  { action: "mathBlock", label: "$$", hint: "Math block" },
  { action: "mermaid", label: "Diagram", hint: "Mermaid diagram" },
];

const MarkdownNoteEditor = forwardRef<MarkdownNoteEditorHandle, MarkdownNoteEditorProps>(function MarkdownNoteEditor(
  { noteId, value, onChange, lang },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mobileView, setMobileView] = useState<"write" | "preview">("write");
  const [error, setError] = useState<string | null>(null);
  const previewContent = useDeferredValue(value);

  const replaceSelection = (text: string, start: number, end: number) => {
    onChange(text);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start, end);
    });
  };

  const insertMarkdown = (markdown: string) => {
    const area = textareaRef.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + markdown + value.slice(end);
    replaceSelection(next, start + markdown.length, start + markdown.length);
    setMobileView("write");
  };

  useImperativeHandle(ref, () => ({ insertMarkdown }));

  const applyAction = (action: MarkdownAction) => {
    const area = textareaRef.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    let url: string | undefined;
    if (action === "link" || action === "image") {
      const entered = window.prompt(
        lang === "th" ? "ใส่ URL แบบ HTTPS" : "Enter an HTTPS URL",
        "https://",
      );
      if (entered === null) return;
      url = entered;
    }
    try {
      const edit = editMarkdownSelection(value, start, end, action, url);
      replaceSelection(edit.text, edit.selectionStart, edit.selectionEnd);
      setError(null);
      setMobileView("write");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid URL");
    }
  };

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col rounded-lg border border-neutral-800 bg-neutral-950/70 overflow-hidden">
      <div role="toolbar" aria-label={lang === "th" ? "เครื่องมือ Markdown" : "Markdown tools"} className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-800 p-2">
        {ACTIONS.map(({ action, label, hint }) => (
          <button
            key={action}
            type="button"
            title={hint}
            aria-label={hint}
            onClick={() => applyAction(action)}
            className="shrink-0 whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-500 active:bg-neutral-700"
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="border-b border-neutral-800 px-3 py-2 text-xs text-rose-300">{error}</p>}
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-2 text-xs text-neutral-400 lg:hidden">
        <span>{lang === "th" ? "แก้ Markdown แล้วดูผลลัพธ์" : "Write Markdown and see the result"}</span>
        <div role="group" aria-label={lang === "th" ? "มุมมอง editor" : "Editor view"} className="flex rounded border border-neutral-700 p-0.5">
          <button type="button" aria-pressed={mobileView === "write"} onClick={() => setMobileView("write")} className={`rounded px-2 py-1 ${mobileView === "write" ? "bg-neutral-700 text-white" : "text-neutral-400"}`}>{lang === "th" ? "เขียน" : "Write"}</button>
          <button type="button" aria-pressed={mobileView === "preview"} onClick={() => setMobileView("preview")} className={`rounded px-2 py-1 ${mobileView === "preview" ? "bg-neutral-700 text-white" : "text-neutral-400"}`}>{lang === "th" ? "ตัวอย่าง" : "Preview"}</button>
        </div>
      </div>
      <div className="grid flex-1 min-h-0 min-w-0 lg:grid-cols-2">
        <div className={`${mobileView === "preview" ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-col lg:border-r border-neutral-800`}>
          <div className="hidden lg:block shrink-0 border-b border-neutral-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Markdown</div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={event => onChange(event.target.value)}
            aria-label={lang === "th" ? "เนื้อหา Markdown" : "Markdown content"}
            spellCheck
            className="min-h-[360px] flex-1 resize-none overflow-auto bg-transparent p-4 font-mono text-[13px] leading-6 text-neutral-200 outline-none placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-indigo-500"
            placeholder={lang === "th" ? "เริ่มเขียน Markdown..." : "Start writing Markdown..."}
          />
        </div>
        <div className={`${mobileView === "write" ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-col`}>
          <div className="hidden lg:block shrink-0 border-b border-neutral-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Preview</div>
          <MarkdownViewer
            note={{ id: noteId, title: "", content: previewContent, createdAt: "", updatedAt: "" }}
            lang={lang}
            preview
          />
        </div>
      </div>
    </div>
  );
});

export default MarkdownNoteEditor;
