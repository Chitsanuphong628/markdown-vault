export const TEXT_SCALE_STEPS = [100, 125, 150, 175, 200] as const;
export const DEFAULT_TEXT_SCALE = 100;
export const TEXT_SCALE_STORAGE_KEY = "nota_text_scale";

export type TextScale = (typeof TEXT_SCALE_STEPS)[number];

export function parseTextScale(value: string | null | undefined): TextScale {
  const parsed = Number(value);
  return TEXT_SCALE_STEPS.includes(parsed as TextScale) ? parsed as TextScale : DEFAULT_TEXT_SCALE;
}

export function nextTextScale(current: number, direction: -1 | 1): TextScale {
  const currentIndex = TEXT_SCALE_STEPS.indexOf(parseTextScale(String(current)));
  const nextIndex = Math.max(0, Math.min(TEXT_SCALE_STEPS.length - 1, currentIndex + direction));
  return TEXT_SCALE_STEPS[nextIndex];
}
