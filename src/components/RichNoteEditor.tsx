"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { JSONContent } from "@tiptap/core";
import {
  Bold,
  Italic,
  Strikethrough,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  Plus,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
} from "lucide-react";
import { parseNoteTheme } from "@/lib/noteTheme";
import { isSupportedRichEditorLinkUrl, serializeRichEditorMarkdown } from "@/lib/richEditorCompatibility";
import { createRichNoteEditorExtensions } from "@/lib/richNoteEditorExtensions";
import { canPreserveMarkdownBlocks, prepareMarkdownForEditor } from "@/lib/markdownBlocks";
import { isSafeImageUrl } from "@/lib/markdownEditing";
import type { Language } from "@/lib/i18n";

export interface RichNoteEditorHandle {
  flush: () => string;
  insertText: (text: string) => void;
  insertMarkdown: (markdown: string) => void;
}

interface RichNoteEditorProps {
  initialContent: string;
  onChange: (markdown: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onAlignmentFailure?: () => void;
  autoFocus?: boolean;
  lang: Language;
  onOpenDiagram: () => void;
}

function ToolbarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${
        active ? "bg-indigo-500/20 text-indigo-200" : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

const RichNoteEditor = forwardRef<RichNoteEditorHandle, RichNoteEditorProps>(function RichNoteEditor(
  { initialContent, onChange, onDirtyChange, onAlignmentFailure, autoFocus = false, lang, onOpenDiagram },
  ref,
) {
  const { color: noteColor, cleanContent } = useMemo(() => parseNoteTheme(initialContent), [initialContent]);
  const preparedMarkdown = useMemo(() => prepareMarkdownForEditor(cleanContent).markdown, [cleanContent]);
  const onChangeRef = useRef(onChange);
  const onDirtyChangeRef = useRef(onDirtyChange);
  const onAlignmentFailureRef = useRef(onAlignmentFailure);
  const noteColorRef = useRef(noteColor);
  const sourceContentRef = useRef(initialContent);
  const lastEmittedMarkdownRef = useRef(initialContent);
  const baselineDocumentRef = useRef("");
  const editorRef = useRef<Editor | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insertMenuRef = useRef<HTMLDivElement | null>(null);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onDirtyChangeRef.current = onDirtyChange; }, [onDirtyChange]);
  useEffect(() => { onAlignmentFailureRef.current = onAlignmentFailure; }, [onAlignmentFailure]);
  useEffect(() => { noteColorRef.current = noteColor; }, [noteColor]);

  const flushMarkdown = useCallback((targetEditor?: Editor): string => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const target = targetEditor || editorRef.current;
    if (!target) return sourceContentRef.current;

    const currentDocument = JSON.stringify(target.getJSON());
    const rawMarkdown = target.getMarkdown();
    const markdown = serializeRichEditorMarkdown({
      originalContent: sourceContentRef.current,
      bodyMarkdown: rawMarkdown,
      baselineDocument: baselineDocumentRef.current,
      currentDocument,
      parseDocument: markdown => target.storage.markdown.manager.parse(markdown),
      serializeDocument: document => target.storage.markdown.manager.serialize(document as JSONContent),
    });

    if (markdown !== lastEmittedMarkdownRef.current) {
      lastEmittedMarkdownRef.current = markdown;
      sourceContentRef.current = markdown;
      onChangeRef.current(markdown);
    }
    onDirtyChangeRef.current(false);
    baselineDocumentRef.current = currentDocument;
    return markdown;
  }, []);

  const editor = useEditor({
    extensions: createRichNoteEditorExtensions(lang),
    content: preparedMarkdown,
    contentType: "markdown",
    autofocus: autoFocus ? "start" : false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "nota-markdown min-h-[420px] cursor-text focus:outline-none" },
    },
    onCreate: ({ editor: createdEditor }) => {
      editorRef.current = createdEditor;
      const baselineDocument = createdEditor.getJSON();
      baselineDocumentRef.current = JSON.stringify(baselineDocument);
      if (!canPreserveMarkdownBlocks({
        originalBody: cleanContent,
        baselineDocument,
        parseDocument: markdown => createdEditor.storage.markdown.manager.parse(markdown),
      })) onAlignmentFailureRef.current?.();
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const currentDocument = JSON.stringify(updatedEditor.getJSON());
      onDirtyChangeRef.current(currentDocument !== baselineDocumentRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => flushMarkdown(updatedEditor), 250);
    },
    onBlur: ({ editor: blurredEditor }) => { flushMarkdown(blurredEditor); },
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);

  useEffect(() => {
    if (!editor || initialContent === lastEmittedMarkdownRef.current) return;

    sourceContentRef.current = initialContent;
    lastEmittedMarkdownRef.current = initialContent;
    const currentMarkdown = editor.getMarkdown();
    if (preparedMarkdown.trim() !== currentMarkdown.trim()) {
      editor.commands.setContent(preparedMarkdown, { contentType: "markdown", emitUpdate: false });
    }
    const baselineDocument = editor.getJSON();
    baselineDocumentRef.current = JSON.stringify(baselineDocument);
    if (!canPreserveMarkdownBlocks({
      originalBody: cleanContent,
      baselineDocument,
      parseDocument: markdown => editor.storage.markdown.manager.parse(markdown),
    })) onAlignmentFailureRef.current?.();
  }, [preparedMarkdown, initialContent, editor]);

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isInsertMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!insertMenuRef.current?.contains(event.target as Node)) setIsInsertMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsInsertMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isInsertMenuOpen]);

  const insertMarkdown = useCallback((markdown: string) => {
    const target = editorRef.current;
    if (!target) return;
    const prepared = prepareMarkdownForEditor(markdown).markdown;
    const insertedDocument = target.storage.markdown.manager.parse(prepared);
    target.chain().focus().insertContent(insertedDocument.content || []).run();
    flushMarkdown(target);
  }, [flushMarkdown]);

  useImperativeHandle(ref, () => ({
    flush: () => flushMarkdown(),
    insertText: (text: string) => {
      const target = editorRef.current;
      if (!target) return;
      target.chain().focus().insertContent({ type: "text", text }).run();
      flushMarkdown(target);
    },
    insertMarkdown,
  }), [flushMarkdown, insertMarkdown]);

  const addLink = () => {
    if (!editor) return;
    const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ");
    const entered = window.prompt(
      lang === "th" ? "URL ของลิงก์" : "Link URL",
      "https://",
    );
    if (entered === null) return;
    if (!isSupportedRichEditorLinkUrl(entered.trim())) {
      window.alert(lang === "th" ? "URL นี้ใช้ไม่ได้ ใช้ลิงก์ HTTP, HTTPS, อีเมล หรือเบอร์โทร" : "Use an HTTP, HTTPS, email, or phone link.");
      return;
    }

    const href = entered.trim();
    if (selectedText) {
      editor.chain().focus().setLink({ href }).run();
    } else {
      editor.chain().focus().insertContent({
        type: "text",
        text: lang === "th" ? "ลิงก์" : "Link",
        marks: [{ type: "link", attrs: { href } }],
      }).run();
    }
  };

  const insertFromMenu = (kind: "table" | "image" | "code" | "math" | "mathBlock" | "diagram") => {
    setIsInsertMenuOpen(false);
    if (kind === "diagram") {
      onOpenDiagram();
      return;
    }
    if (kind === "image") {
      const url = window.prompt(lang === "th" ? "URL รูปภาพ HTTPS" : "HTTPS image URL", "https://");
      if (url === null) return;
      if (!isSafeImageUrl(url)) {
        window.alert(lang === "th" ? "ใส่ URL รูปภาพ HTTPS ที่ถูกต้อง" : "Enter a valid HTTPS image URL");
        return;
      }
      insertMarkdown(`![${lang === "th" ? "คำอธิบายภาพ" : "Image description"}](${url.trim()})`);
      return;
    }
    if (kind === "math" || kind === "mathBlock") {
      const latex = window.prompt(lang === "th" ? "สูตร LaTeX" : "LaTeX formula", "x^2");
      if (latex === null) return;
      insertMarkdown(kind === "math" ? `$${latex}$` : `$$\n${latex}\n$$`);
      return;
    }
    insertMarkdown(kind === "table"
      ? "| หัวข้อ | รายละเอียด |\n| --- | --- |\n| รายการ | ข้อความ |"
      : "```text\n\n```");
  };

  if (!editor) return <div className="min-h-[420px] flex-1" role="status">{lang === "th" ? "กำลังเปิดโน้ต…" : "Opening note…"}</div>;

  const icon = "h-4 w-4";
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-neutral-800 bg-neutral-950/50">
      <div role="toolbar" aria-label={lang === "th" ? "แทรกเนื้อหา" : "Insert content"} className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-800 px-2 py-1.5">
        <ToolbarButton label={lang === "th" ? "หัวข้อ 1" : "Heading 1"} active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "หัวข้อ 2" : "Heading 2"} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "หัวข้อ 3" : "Heading 3"} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className={icon} /></ToolbarButton>
        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-neutral-800" />
        <ToolbarButton label={lang === "th" ? "รายการหัวข้อย่อย" : "Bulleted list"} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "รายการลำดับเลข" : "Numbered list"} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "เช็กลิสต์" : "Checklist"} active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "คำอ้างอิง" : "Quote"} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "เส้นคั่น" : "Divider"} onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className={icon} /></ToolbarButton>
        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-neutral-800" />
        <div ref={insertMenuRef} className="relative">
          <ToolbarButton label={lang === "th" ? "แทรก" : "Insert"} active={isInsertMenuOpen} onClick={() => setIsInsertMenuOpen(value => !value)}><Plus className={icon} /><span>{lang === "th" ? "แทรก" : "Insert"}</span></ToolbarButton>
          {isInsertMenuOpen && <div role="menu" className="absolute left-0 top-full z-30 mt-1 min-w-48 rounded-md border border-neutral-700 bg-neutral-900 p-1 shadow-xl">
            {([
              ["table", lang === "th" ? "ตาราง" : "Table"],
              ["image", lang === "th" ? "รูปจาก URL" : "Image from URL"],
              ["code", lang === "th" ? "บล็อกโค้ด" : "Code block"],
              ["math", lang === "th" ? "สูตรในบรรทัด" : "Inline formula"],
              ["mathBlock", lang === "th" ? "สูตรแยกบรรทัด" : "Display formula"],
              ["diagram", lang === "th" ? "แผนภาพ" : "Diagram"],
            ] as const).map(([kind, label]) => <button key={kind} type="button" role="menuitem" onMouseDown={event => event.preventDefault()} onClick={() => insertFromMenu(kind)} className="flex min-h-10 w-full items-center rounded px-3 text-left text-xs text-neutral-200 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">{label}</button>)}
          </div>}
        </div>
      </div>
      <BubbleMenu editor={editor} options={{ placement: "top" }}>
        <div role="toolbar" aria-label={lang === "th" ? "จัดรูปแบบข้อความที่เลือก" : "Format selection"} className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 p-1 shadow-xl">
          <ToolbarButton label={lang === "th" ? "ตัวหนา" : "Bold"} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className={icon} /></ToolbarButton>
          <ToolbarButton label={lang === "th" ? "ตัวเอียง" : "Italic"} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className={icon} /></ToolbarButton>
          <ToolbarButton label={lang === "th" ? "ขีดฆ่า" : "Strikethrough"} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className={icon} /></ToolbarButton>
          <ToolbarButton label={lang === "th" ? "แทรกลิงก์" : "Insert link"} active={editor.isActive("link")} onClick={addLink}><Link2 className={icon} /></ToolbarButton>
        </div>
      </BubbleMenu>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

export default RichNoteEditor;
