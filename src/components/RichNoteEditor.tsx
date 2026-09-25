"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
} from "lucide-react";
import { parseNoteTheme } from "@/lib/noteTheme";
import { isSupportedRichEditorLinkUrl, serializeRichEditorMarkdown } from "@/lib/richEditorCompatibility";
import { createRichNoteEditorExtensions } from "@/lib/richNoteEditorExtensions";
import type { Language } from "@/lib/i18n";

export interface RichNoteEditorHandle {
  flush: () => string;
  insertText: (text: string) => void;
}

interface RichNoteEditorProps {
  initialContent: string;
  onChange: (markdown: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  autoFocus?: boolean;
  lang: Language;
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
      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${
        active ? "bg-indigo-500/20 text-indigo-200" : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

const RichNoteEditor = forwardRef<RichNoteEditorHandle, RichNoteEditorProps>(function RichNoteEditor(
  { initialContent, onChange, onDirtyChange, autoFocus = false, lang },
  ref,
) {
  const { color: noteColor, cleanContent } = useMemo(() => parseNoteTheme(initialContent), [initialContent]);
  const onChangeRef = useRef(onChange);
  const onDirtyChangeRef = useRef(onDirtyChange);
  const noteColorRef = useRef(noteColor);
  const sourceContentRef = useRef(initialContent);
  const lastEmittedMarkdownRef = useRef(initialContent);
  const baselineDocumentRef = useRef("");
  const editorRef = useRef<Editor | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onDirtyChangeRef.current = onDirtyChange; }, [onDirtyChange]);
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
    content: cleanContent,
    contentType: "markdown",
    autofocus: autoFocus ? "start" : false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "nota-markdown min-h-[420px] cursor-text focus:outline-none" },
    },
    onCreate: ({ editor: createdEditor }) => {
      editorRef.current = createdEditor;
      baselineDocumentRef.current = JSON.stringify(createdEditor.getJSON());
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
    if (cleanContent.trim() !== currentMarkdown.trim()) {
      editor.commands.setContent(cleanContent, { contentType: "markdown", emitUpdate: false });
      baselineDocumentRef.current = JSON.stringify(editor.getJSON());
    }
  }, [cleanContent, initialContent, editor]);

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, []);

  useImperativeHandle(ref, () => ({
    flush: () => flushMarkdown(),
    insertText: (text: string) => {
      const target = editorRef.current;
      if (!target) return;
      target.chain().focus().insertContent({ type: "text", text }).run();
      flushMarkdown(target);
    },
  }), [flushMarkdown]);

  const addLink = () => {
    if (!editor) return;
    const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ");
    const entered = window.prompt(
      lang === "th" ? "ใส่ URL หรือลิงก์ภายใน" : "Enter a URL or relative link",
      "https://",
    );
    if (entered === null) return;
    if (!isSupportedRichEditorLinkUrl(entered.trim())) {
      window.alert(lang === "th" ? "ลิงก์นี้ใช้ไม่ได้" : "Enter a valid link");
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

  if (!editor) return <div className="min-h-[420px] flex-1" role="status">{lang === "th" ? "กำลังเปิดตัวแก้ไข..." : "Loading editor..."}</div>;

  const icon = "h-4 w-4";
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-neutral-800 bg-neutral-950/50">
      <div role="toolbar" aria-label={lang === "th" ? "จัดรูปแบบข้อความ" : "Text formatting"} className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-800 px-2 py-1.5">
        <ToolbarButton label={lang === "th" ? "หัวข้อ 1" : "Heading 1"} active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "หัวข้อ 2" : "Heading 2"} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "หัวข้อ 3" : "Heading 3"} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className={icon} /></ToolbarButton>
        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-neutral-800" />
        <ToolbarButton label={lang === "th" ? "ตัวหนา" : "Bold"} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "ตัวเอียง" : "Italic"} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "ขีดฆ่า" : "Strikethrough"} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "แทรกลิงก์" : "Insert link"} active={editor.isActive("link")} onClick={addLink}><Link2 className={icon} /></ToolbarButton>
        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-neutral-800" />
        <ToolbarButton label={lang === "th" ? "รายการหัวข้อ" : "Bullet list"} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "รายการลำดับเลข" : "Numbered list"} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "เช็กลิสต์" : "Checklist"} active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "ข้อความอ้างอิง" : "Quote"} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className={icon} /></ToolbarButton>
        <ToolbarButton label={lang === "th" ? "เส้นคั่น" : "Divider"} onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className={icon} /></ToolbarButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

export default RichNoteEditor;
