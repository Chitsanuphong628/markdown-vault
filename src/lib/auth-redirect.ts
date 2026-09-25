/** Only the OAuth consent flow currently supports resuming after sign-in. */
export function postLoginPath(search: string): string {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";

  try {
    const url = new URL(next, "https://nota.invalid");
    if (url.origin !== "https://nota.invalid" || url.pathname !== "/oauth/authorize") return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}
