import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "@tiptap/markdown";
import type { Extensions } from "@tiptap/core";
import type { Language } from "@/lib/i18n";

export function createRichNoteEditorExtensions(lang: Language): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false },
    }),
    Placeholder.configure({
      placeholder: lang === "th" ? "เริ่มพิมพ์บันทึกของคุณ..." : "Start writing your note...",
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown,
  ];
}
