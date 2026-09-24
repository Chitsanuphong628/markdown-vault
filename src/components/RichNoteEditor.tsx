"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  BarChart2,
  Mic,
} from "lucide-react";
import { parseNoteTheme, applyNoteBodyChange } from "@/lib/noteTheme";
import { Language } from "@/lib/i18n";

interface RichNoteEditorProps {
  initialContent: string;
  onChange: (markdown: string) => void;
  onOpenChartWizard?: () => void;
  onTriggerVoice?: () => void;
  lang?: Language;
}

interface SlashCommand {
  id: string;
  label: { en: string; th: string };
  desc: { en: string; th: string };
  icon: React.ElementType;
  action: (editor: ReturnType<typeof useEditor>) => void;
}

export default function RichNoteEditor({
  initialContent,
  onChange,
  onOpenChartWizard,
  onTriggerVoice,
  lang = "en",
}: RichNoteEditorProps) {
  // Extract theme color and clean content without raw frontmatter
  const { color: noteColor, cleanContent } = useMemo(
    () => parseNoteTheme(initialContent),
    [initialContent]
  );

  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const noteColorRef = useRef(noteColor);
  const sourceContentRef = useRef(initialContent);
  const lastEmittedMarkdownRef = useRef<string>(initialContent);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    noteColorRef.current = noteColor;
  }, [noteColor]);

  useEffect(() => {
    sourceContentRef.current = initialContent;
  }, [initialContent]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const flushMarkdown = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (edInstance?: any) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const targetEd = edInstance || editorRef.current;
      if (!targetEd) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawMarkdown = (targetEd.storage as any).markdown?.getMarkdown?.() || "";
      const currentNoteColor = noteColorRef.current;
      const withTheme = applyNoteBodyChange(sourceContentRef.current, rawMarkdown, currentNoteColor);
      if (withTheme !== lastEmittedMarkdownRef.current) {
        lastEmittedMarkdownRef.current = withTheme;
        sourceContentRef.current = withTheme;
        onChange(withTheme);
      }
    },
    [onChange]
  );

  const slashCommands: SlashCommand[] = useMemo(
    () => [
      {
        id: "h1",
        label: { en: "Heading 1", th: "หัวข้อใหญ่ (H1)" },
        desc: { en: "Large section header", th: "หัวข้อหลักของเนื้อหา" },
        icon: Heading1,
        action: (ed) => {
          if (!ed) return;
          ed.chain().focus().setHeading({ level: 1 }).run();
        },
      },
      {
        id: "h2",
        label: { en: "Heading 2", th: "หัวข้อย่อย (H2)" },
        desc: { en: "Medium section header", th: "หัวข้อย่อยระดับ 2" },
        icon: Heading2,
        action: (ed) => {
          if (!ed) return;
          ed.chain().focus().setHeading({ level: 2 }).run();
        },
      },
      {
        id: "h3",
        label: { en: "Heading 3", th: "หัวข้อย่อย (H3)" },
        desc: { en: "Small section header", th: "หัวข้อย่อยระดับ 3" },
        icon: Heading3,
        action: (ed) => {
          if (!ed) return;
          ed.chain().focus().setHeading({ level: 3 }).run();
        },
      },
      {
        id: "todo",
        label: { en: "To-Do List", th: "รายการสิ่งที่ต้องทำ" },
        desc: { en: "Track tasks with checkboxes", th: "เช็คลิสต์คลิกติ๊กถูกได้" },
        icon: CheckSquare,
        action: (ed) => {
          if (!ed) return;
          ed.chain().focus().toggleTaskList().run();
        },
      },
      {
        id: "bullet",
        label: { en: "Bullet List", th: "รายการแบบจุด" },
        desc: { en: "Create an unordered list", th: "ลิสต์หัวข้อแบบจุดกลม" },
        icon: List,
        action: (ed) => {
          if (!ed) return;
          ed.chain().focus().toggleBulletList().run();
        },
      },
      {
        id: "ordered",
        label: { en: "Numbered List", th: "รายการแบบตัวเลข" },
        desc: { en: "Create an ordered numbered list", th: "ลิสต์เรียงตามลำดับ 1, 2, 3" },
        icon: ListOrdered,
        action: (ed) => {
          if (!ed) return;
          ed.chain().focus().toggleOrderedList().run();
        },
      },
      {
        id: "quote",
        label: { en: "Blockquote", th: "กล่องคำคม / อ้างอิง" },
        desc: { en: "Highlight a quote or note", th: "กล่องเน้นข้อความอ้างอิง" },
        icon: Quote,
        action: (ed) => {
          if (!ed) return;
          ed.chain().focus().toggleBlockquote().run();
        },
      },
      {
        id: "code",
        label: { en: "Code Block", th: "บล็อกเขียนโค้ด" },
        desc: { en: "Formatted code block with syntax", th: "กล่องสำหรับใส่โค้ดโปรแกรม" },
        icon: Code,
        action: (ed) => {
          if (!ed) return;
          ed.chain().focus().toggleCodeBlock().run();
        },
      },
      {
        id: "divider",
        label: { en: "Divider", th: "เส้นคั่นเนื้อหา" },
        desc: { en: "Visual horizontal line", th: "เส้นคั่นแบ่งส่วนข้อความ" },
        icon: Minus,
        action: (ed) => {
          if (!ed) return;
          ed.chain().focus().setHorizontalRule().run();
        },
      },
      {
        id: "chart",
        label: { en: "Chart Wizard", th: "สร้างชาร์ตและผังงาน" },
        desc: { en: "Insert visual Bar, Pie, Flowchart", th: "สร้างกราฟแท่ง วงกลม หรือผังงาน" },
        icon: BarChart2,
        action: () => {
          onOpenChartWizard?.();
        },
      },
      {
        id: "voice",
        label: { en: "Voice Dictation", th: "จดโน้ตด้วยเสียง" },
        desc: { en: "Dictate via microphone", th: "เปิดไมโครโฟนพูดแทนการพิมพ์" },
        icon: Mic,
        action: () => {
          onTriggerVoice?.();
        },
      },
    ],
    [onOpenChartWizard, onTriggerVoice]
  );

  const filteredCommands = useMemo(() => {
    if (!slashQuery) return slashCommands;
    const q = slashQuery.toLowerCase().trim();
    return slashCommands.filter(
      (c) =>
        c.id.includes(q) ||
        c.label.en.toLowerCase().includes(q) ||
        c.label.th.toLowerCase().includes(q)
    );
  }, [slashQuery, slashCommands]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          lang === "th"
            ? "พิมพ์เนื้อหาโน้ต หรือพิมพ์ '/' เพื่อเรียกเมนูด่วน..."
            : "Write something, or press '/' for commands...",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
      }),
    ],
    content: cleanContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[420px] cursor-text",
      },
      handleKeyDown: (view, event) => {
        if (slashQuery !== null) {
          if (filteredCommands.length === 0) return false;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSlashIndex((prev) => (prev + 1) % filteredCommands.length);
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            return true;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const cmd = filteredCommands[slashIndex];
            if (cmd) {
              executeCommand(cmd);
            }
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setSlashQuery(null);
            return true;
          }
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          flushMarkdown();
        }
        return false;
      },
    },
    onBlur: () => {
      flushMarkdown();
    },
    onUpdate: ({ editor: ed }) => {
      // Check for slash query (instant)
      const { $from } = ed.state.selection;
      const text = $from.parent.textContent;

      if (text.startsWith("/")) {
        setSlashQuery(text.slice(1));
        setSlashIndex(0);
      } else {
        setSlashQuery(null);
      }

      // Debounce markdown serialization to keep 60fps keystroke responsiveness
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        flushMarkdown(ed);
      }, 250);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const executeCommand = (cmd: SlashCommand) => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const start = $from.start();
    const end = $from.pos;

    // Remove the slash text
    editor.chain().focus().deleteRange({ from: start, to: end }).run();
    cmd.action(editor);
    setSlashQuery(null);
  };

  // Synchronize when clean content changes from outside (e.g. note switch, voice transcript)
  useEffect(() => {
    if (!editor) return;
    if (initialContent === lastEmittedMarkdownRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentMarkdown = (editor.storage as any).markdown?.getMarkdown?.() || "";
    if (cleanContent.trim() !== currentMarkdown.trim()) {
      editor.commands.setContent(cleanContent);
      lastEmittedMarkdownRef.current = initialContent;
      sourceContentRef.current = initialContent;
    }
  }, [cleanContent, initialContent, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative w-full flex-1 flex flex-col">
      {/* Floating Bubble Menu on selection */}
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-0.5 bg-neutral-900/95 border border-neutral-750 shadow-2xl rounded-xl p-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 z-40"
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive("bold")
              ? "bg-indigo-600 text-white"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Bold (⌘B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive("italic")
              ? "bg-indigo-600 text-white"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Italic (⌘I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive("strike")
              ? "bg-indigo-600 text-white"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive("code")
              ? "bg-indigo-600 text-white"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Inline Code"
        >
          <Code className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-neutral-800 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-1.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            editor.isActive("heading", { level: 1 })
              ? "bg-indigo-600 text-white"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="H1"
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-1.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            editor.isActive("heading", { level: 2 })
              ? "bg-indigo-600 text-white"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="H2"
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive("taskList")
              ? "bg-indigo-600 text-white"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Task List"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive("bulletList")
              ? "bg-indigo-600 text-white"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
      </BubbleMenu>

      {/* Floating Slash Commands Menu */}
      {slashQuery !== null && filteredCommands.length > 0 && (
        <div
          ref={slashMenuRef}
          className="absolute z-50 left-2 top-10 w-72 max-h-80 overflow-y-auto bg-neutral-900 border border-neutral-750 shadow-2xl rounded-xl p-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-800 mb-1 flex items-center justify-between">
            <span>{lang === "th" ? "คำสั่งด่วน" : "Quick Blocks"}</span>
            <span className="text-[9px] font-mono text-neutral-600">↑↓ to navigate</span>
          </div>

          <div className="space-y-0.5">
            {filteredCommands.map((cmd, idx) => {
              const IconComp = cmd.icon;
              const isSelected = idx === slashIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSlashIndex(idx)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/30"
                      : "text-neutral-300 hover:bg-neutral-800/60 border border-transparent"
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-md ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {cmd.label[lang] || cmd.label.en}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate">
                      {cmd.desc[lang] || cmd.desc.en}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="w-full flex-1 bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 text-neutral-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-inner">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
