"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useLanguagePreference } from "@/lib/useLanguagePreference";
import { DEFAULT_TEXT_SCALE, nextTextScale, parseTextScale, TEXT_SCALE_STORAGE_KEY } from "@/lib/textScale";

function readSavedTextScale() {
  if (typeof window === "undefined") return DEFAULT_TEXT_SCALE;
  try { return parseTextScale(window.localStorage.getItem(TEXT_SCALE_STORAGE_KEY)); } catch { return DEFAULT_TEXT_SCALE; }
}

export default function TextScaleControl() {
  const [lang] = useLanguagePreference();
  const [scale, setScale] = useState<number>(readSavedTextScale);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const labels = lang === "th"
    ? { title: "ขนาดข้อความ", decrease: "ลดขนาดข้อความ", increase: "เพิ่มขนาดข้อความ", close: "ปิดตัวปรับขนาดข้อความ" }
    : { title: "Text size", decrease: "Decrease text size", increase: "Increase text size", close: "Close text size control" };

  useEffect(() => {
    document.documentElement.style.setProperty("--nota-text-scale", String(scale / 100));
  }, [scale]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const changeScale = (direction: -1 | 1) => {
    const next = nextTextScale(scale, direction);
    setScale(next);
    document.documentElement.style.setProperty("--nota-text-scale", String(next / 100));
    try { window.localStorage.setItem(TEXT_SCALE_STORAGE_KEY, String(next)); } catch { /* Keep the current page setting if storage is unavailable. */ }
  };

  return (
    <div
      ref={rootRef}
      className="fixed z-[35] flex flex-col items-end gap-2"
      style={{ right: "max(0.75rem, env(safe-area-inset-right))", bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {isOpen && (
        <div id="nota-text-scale-controls" role="group" aria-label={labels.title} className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-xl">
          <button type="button" aria-label={labels.decrease} title={labels.decrease} disabled={scale <= 100} onClick={() => changeScale(-1)} className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-100 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-indigo-400">
            <Minus className="h-4 w-4" />
          </button>
          <span aria-live="polite" className="min-w-12 text-center text-sm tabular-nums text-neutral-100">{scale}%</span>
          <button type="button" aria-label={labels.increase} title={labels.increase} disabled={scale >= 200} onClick={() => changeScale(1)} className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-100 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-indigo-400">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
      <button type="button" aria-label={isOpen ? labels.close : labels.title} aria-expanded={isOpen} aria-controls={isOpen ? "nota-text-scale-controls" : undefined} onClick={() => setIsOpen(value => !value)} className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-100 shadow-lg hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-indigo-400">
        <span aria-hidden="true" className="text-sm font-semibold tracking-tight">Aa</span>
      </button>
    </div>
  );
}
