"use client";

import { Globe } from "lucide-react";

interface LanguageToggleProps {
  lang: "en" | "th";
  setLang: (lang: "en" | "th") => void;
}

export default function LanguageToggle({ lang, setLang }: LanguageToggleProps) {
  return (
    <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-neutral-900/90 border border-neutral-800 text-xs font-medium backdrop-blur-md shadow-sm">
      <div className="pl-2 pr-1 text-neutral-400 flex items-center">
        <Globe className="w-3.5 h-3.5" />
      </div>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
          lang === "en"
            ? "bg-indigo-600 text-white font-semibold shadow-sm"
            : "text-neutral-400 hover:text-neutral-200"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("th")}
        className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
          lang === "th"
            ? "bg-indigo-600 text-white font-semibold shadow-sm"
            : "text-neutral-400 hover:text-neutral-200"
        }`}
      >
        TH
      </button>
    </div>
  );
}
