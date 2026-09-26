"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Language } from "@/lib/i18n";

const subscribers = new Set<() => void>();
let fallbackLanguage: Language = "en";

function getLanguageSnapshot(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem("nota_lang");
    if (saved === "en" || saved === "th") return saved;
  } catch {
    // Use the in-memory choice when browser storage is unavailable.
  }
  return fallbackLanguage;
}

function getServerLanguageSnapshot(): Language {
  return "en";
}

function subscribeToLanguage(onChange: () => void) {
  subscribers.add(onChange);
  const handleStorage = () => onChange();
  window.addEventListener("storage", handleStorage);
  return () => {
    subscribers.delete(onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function setLanguage(next: Language) {
  fallbackLanguage = next;
  try {
    window.localStorage.setItem("nota_lang", next);
  } catch {
    // Keep the selection active for this page when storage is unavailable.
  }
  document.documentElement.lang = next;
  subscribers.forEach(onChange => onChange());
}

export function useLanguagePreference() {
  const lang = useSyncExternalStore<Language>(subscribeToLanguage, getLanguageSnapshot, getServerLanguageSnapshot);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return [lang, setLanguage] as const;
}
