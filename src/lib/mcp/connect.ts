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

export function isMcpEndpointReady(
  mcpServerUrl: string,
  authorizationMetadata: unknown,
  resourceMetadata: unknown,
  endpointStatus: number,
  challenge: string | null,
): boolean {
  if (!isMcpOAuthMetadataReady(authorizationMetadata)) return false;
  if (!resourceMetadata || typeof resourceMetadata !== "object") return false;
  const authorization = authorizationMetadata as Record<string, unknown>;
  const resource = resourceMetadata as Record<string, unknown>;
  return resource.resource === mcpServerUrl
    && Array.isArray(resource.authorization_servers)
    && resource.authorization_servers.includes(authorization.issuer)
    && endpointStatus === 401
    && /^Bearer(?:\s|$)/i.test(challenge ?? "");
}
