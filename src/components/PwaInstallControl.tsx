"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Download, X } from "lucide-react";
import { Language, I18N_MAIN } from "@/lib/i18n";
import { getPwaInstallAction, isIosLike, isPwaInstalled, isSafariOnMac } from "@/lib/pwaInstall";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaInstallControlProps {
  lang: Language;
}

export default function PwaInstallControl({ lang }: PwaInstallControlProps) {
  const t = I18N_MAIN[lang];
  const instructionsId = useId();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const maxTouchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0;
  const isIos = isIosLike(userAgent, maxTouchPoints);
  const isSafariMac = isSafariOnMac(userAgent, maxTouchPoints);

  useEffect(() => {
    const checkInstalled = () => {
      setInstalled(isPwaInstalled(
        window.matchMedia("(display-mode: standalone)").matches,
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      ));
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };

    checkInstalled();
    const displayMode = window.matchMedia("(display-mode: standalone)");
    displayMode.addEventListener("change", checkInstalled);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      displayMode.removeEventListener("change", checkInstalled);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) {
      setShowInstructions((visible) => !visible);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setInstallPrompt(null);
      setShowInstructions(true);
    }
  }, [installPrompt]);

  const action = getPwaInstallAction({ installed, hasPrompt: Boolean(installPrompt) });
  if (action === "hidden") return null;

  return (
    <div className="border-t border-neutral-800/80 px-3 py-2">
      <button
        type="button"
        onClick={handleInstall}
        aria-expanded={action === "instructions" ? showInstructions : undefined}
        aria-controls={action === "instructions" ? instructionsId : undefined}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t.pwaInstall}</span>
      </button>

      {action === "instructions" && showInstructions && (
        <div id={instructionsId} className="mt-1 rounded-md bg-neutral-900 px-3 py-2 text-[11px] leading-relaxed text-neutral-400">
          <div className="flex items-start justify-between gap-2">
            <p>
              {isIos
                ? t.pwaInstallIosInstructions
                : isSafariMac
                  ? t.pwaInstallSafariMacInstructions
                  : t.pwaInstallBrowserInstructions}
            </p>
            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              aria-label={t.pwaInstallClose}
              className="-mr-1 -mt-1 rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
