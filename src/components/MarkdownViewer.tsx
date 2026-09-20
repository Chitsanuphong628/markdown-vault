"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import "highlight.js/styles/atom-one-dark.css";
import { Check, Copy, FileText, Calendar, Folder as FolderIcon } from "lucide-react";
import TableOfContents, { HeadingItem } from "./TableOfContents";
import MermaidChart from "./MermaidChart";

interface MarkdownViewerProps {
  note: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    folder?: { name: string } | null;
  };
}

function CodeBlock({ className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const isInline = !className;

  if (isInline) {
    return (
      <code className="bg-neutral-800/80 text-pink-400 font-mono text-[0.85em] px-1.5 py-0.5 rounded border border-neutral-700/50" {...props}>
        {children}
      </code>
    );
  }

  const language = className ? className.replace(/language-/, "") : "text";

  // If language is mermaid, render dynamic chart
  if (language === "mermaid") {
    const chartContent = String(children).replace(/\n$/, "");
    return <MermaidChart chart={chartContent} />;
  }

  const handleCopy = () => {
    const codeString = String(children).replace(/\n$/, "");
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-neutral-800 bg-[#1e1e2e]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-900/90 border-b border-neutral-800/80 text-xs font-mono text-neutral-400">
        <span className="uppercase tracking-wider">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 py-1 px-2.5 rounded-md hover:bg-neutral-800 transition-colors text-neutral-300 text-xs cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed font-mono">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export default function MarkdownViewer({ note }: MarkdownViewerProps) {
  // Extract headings for Table of Contents
  const headings = useMemo(() => {
    const lines = note.content.split("\n");
    const headingList: HeadingItem[] = [];

    lines.forEach((line) => {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().replace(/[#*`_~]/g, "");
        const id = text
          .toLowerCase()
          .replace(/[^\w\u0E00-\u0E7F\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-");

        if (text && id) {
          headingList.push({ id, text, level });
        }
      }
    });

    return headingList;
  }, [note.content]);

  return (
    <div className="flex-1 flex overflow-y-auto">
      <div className="flex-1 max-w-4xl mx-auto px-6 py-8 min-w-0">
        {/* Document Header */}
        <div className="mb-8 pb-6 border-b border-neutral-800">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
            {note.folder && (
              <span className="flex items-center gap-1 bg-neutral-800/80 px-2.5 py-1 rounded-md text-neutral-300 font-medium">
                <FolderIcon className="w-3.5 h-3.5 text-indigo-400" />
                {note.folder.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(note.updatedAt).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-100 mb-2">
            {note.title}
          </h1>
        </div>

        {/* Markdown Render Area */}
        <article className="prose prose-invert prose-neutral max-w-none 
          [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mt-8 [&>h1]:mb-4 [&>h1]:pb-2 [&>h1]:border-b [&>h1]:border-neutral-800
          [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mt-8 [&>h2]:mb-3 [&>h2]:pb-1.5 [&>h2]:border-b [&>h2]:border-neutral-800/60
          [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-2
          [&>p]:text-neutral-300 [&>p]:leading-relaxed [&>p]:mb-4
          [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ul]:space-y-1.5 [&>ul]:text-neutral-300
          [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>ol]:space-y-1.5 [&>ol]:text-neutral-300
          [&>blockquote]:border-l-4 [&>blockquote]:border-indigo-500/60 [&>blockquote]:pl-4 [&>blockquote]:py-1 [&>blockquote]:my-4 [&>blockquote]:text-neutral-400 [&>blockquote]:italic [&>blockquote]:bg-indigo-950/20 [&>blockquote]:rounded-r-lg
          [&>table]:w-full [&>table]:my-6 [&>table]:border-collapse [&>table]:border [&>table]:border-neutral-800
          [&_th]:border [&_th]:border-neutral-800 [&_th]:px-4 [&_th]:py-2.5 [&_th]:bg-neutral-900 [&_th]:text-neutral-200 [&_th]:text-left [&_th]:font-semibold
          [&_td]:border [&_td]:border-neutral-800 [&_td]:px-4 [&_td]:py-2 [&_td]:text-neutral-300
          [&>hr]:border-neutral-800 [&>hr]:my-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug, rehypeHighlight]}
            components={{
              code: CodeBlock,
            }}
          >
            {note.content}
          </ReactMarkdown>
        </article>
      </div>

      {/* Dynamic Table of Contents */}
      <TableOfContents headings={headings} />
    </div>
  );
}
