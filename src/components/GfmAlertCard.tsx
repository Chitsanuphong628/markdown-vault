import { AlertCircle } from "lucide-react";
import type { BlockquoteHTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Language } from "@/lib/i18n";
import { parseGfmAlert, type GfmAlertType } from "@/lib/gfmAlerts";

const labels: Record<Language, Record<GfmAlertType, string>> = {
  en: {
    NOTE: "Note",
    TIP: "Tip",
    IMPORTANT: "Important",
    WARNING: "Warning",
    CAUTION: "Caution",
  },
  th: {
    NOTE: "หมายเหตุ",
    TIP: "เคล็ดลับ",
    IMPORTANT: "สำคัญ",
    WARNING: "คำเตือน",
    CAUTION: "ข้อควรระวัง",
  },
};

const styles: Record<GfmAlertType, { border: string; label: string }> = {
  NOTE: { border: "border-sky-500/70", label: "text-sky-300" },
  TIP: { border: "border-emerald-500/70", label: "text-emerald-300" },
  IMPORTANT: { border: "border-violet-500/70", label: "text-violet-300" },
  WARNING: { border: "border-amber-500/70", label: "text-amber-300" },
  CAUTION: { border: "border-rose-500/70", label: "text-rose-300" },
};

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

export function GfmAlertCard({ type, body, lang }: {
  type: GfmAlertType;
  body: string;
  lang: Language;
}) {
  const label = labels[lang][type];
  const style = styles[type];

  return (
    <aside
      role="note"
      aria-label={label}
      className={`my-3 border-l-2 ${style.border} bg-neutral-900/40 px-3 py-2.5 text-neutral-200`}
    >
      <div className={`mb-1 flex items-center gap-1.5 text-xs font-semibold ${style.label}`}>
        <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="nota-gfm-alert-body text-sm leading-6">
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={{
            // Images remain remote URL references, matching note storage behavior.
            img: ({ alt, ...props }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img {...props} alt={alt || ""} loading="lazy" referrerPolicy="no-referrer" />
            ),
          }}
        >
          {body}
        </ReactMarkdown>
      </div>
    </aside>
  );
}

export function GfmAlertBlockquote({ source, uiLanguage, children, ...props }: BlockquoteHTMLAttributes<HTMLQuoteElement> & {
  source: string;
  uiLanguage: Language;
}) {
  const alert = parseGfmAlert(source);
  if (alert) return <GfmAlertCard type={alert.type} body={alert.body} lang={uiLanguage} />;
  return <blockquote {...props}>{children}</blockquote>;
}

export function GfmAlertMarkdownBlockquote({ markdown, markdownNode, uiLanguage, ...props }: BlockquoteHTMLAttributes<HTMLQuoteElement> & {
  markdown: string;
  markdownNode?: { position?: { start?: { offset?: number }; end?: { offset?: number } } };
  uiLanguage: Language;
}) {
  const start = markdownNode?.position?.start?.offset;
  const end = markdownNode?.position?.end?.offset;
  const source = typeof start === "number" && typeof end === "number"
    ? markdown.slice(start, end)
    : "";
  return <GfmAlertBlockquote source={source} uiLanguage={uiLanguage} {...props} />;
}
