export type PwaInstallAction = "hidden" | "prompt" | "instructions";

export function getPwaInstallAction(input: { installed: boolean; hasPrompt: boolean }): PwaInstallAction {
  if (input.installed) return "hidden";
  return input.hasPrompt ? "prompt" : "instructions";
}

export function isPwaInstalled(displayModeStandalone: boolean, legacyStandalone: boolean): boolean {
  return displayModeStandalone || legacyStandalone;
}

export function isIosLike(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent)
    || (/Macintosh|MacIntel/i.test(userAgent) && maxTouchPoints > 1);
}

export function isSafariOnMac(userAgent: string, maxTouchPoints: number): boolean {
  return /Macintosh|MacIntel/i.test(userAgent)
    && maxTouchPoints <= 1
    && /Safari/i.test(userAgent)
    && !/(Chrome|Chromium|CriOS|Edg|FxiOS)/i.test(userAgent);
}
