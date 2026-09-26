export function createCursorInstallUrl(mcpServerUrl: string): string {
  const config = JSON.stringify({ url: mcpServerUrl });
  const bytes = new TextEncoder().encode(config);
  const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
  const params = new URLSearchParams({ name: "nota-vault", config: encoded });
  return `cursor://anysphere.cursor-deeplink/mcp/install?${params.toString()}`;
}

export function isMcpOAuthMetadataReady(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const data = metadata as Record<string, unknown>;
  return typeof data.issuer === "string"
    && typeof data.authorization_endpoint === "string"
    && typeof data.token_endpoint === "string"
    && typeof data.registration_endpoint === "string"
    && Array.isArray(data.code_challenge_methods_supported)
    && data.code_challenge_methods_supported.includes("S256");
}
