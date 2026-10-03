export const GFM_ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
export type GfmAlertType = typeof GFM_ALERT_TYPES[number];

export function parseGfmAlert(source: string): { type: GfmAlertType; body: string } | null {
  const lines = source.split(/\r?\n/);
  const header = lines[0]?.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*$/i);
  if (!header) return null;

  return {
    type: header[1]!.toUpperCase() as GfmAlertType,
    body: lines.slice(1).map(line => line.replace(/^>[\t ]?/, "")).join("\n"),
  };
}
