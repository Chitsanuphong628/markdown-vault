"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Key, Loader2 } from "lucide-react";
import type { Language } from "@/shared/language";
import { I18N_MCP, MCP_TOOLS } from "../shared";
import { createCursorInstallUrl, isMcpEndpointReady } from "./connect";

type Readiness = "checking" | "ready" | "unavailable";
type Credential = { id: string; createdAt: string; expiresAt: string; revokedAt: string | null };

export default function McpSettingsPanel({ lang, isActive }: { lang: Language; isActive: boolean }) {
  const m = I18N_MCP[lang] || I18N_MCP.en;
  const [manualConfigTab, setManualConfigTab] = useState<"cursor" | "claude">("cursor");
  const [readiness, setReadiness] = useState<Readiness>("checking");
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [keyError, setKeyError] = useState("");
  const [credentialsError, setCredentialsError] = useState("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  const getKeyFailureMessage = useCallback((status: number, serverMessage: unknown, fallback: string) => {
    if (status === 401) return m.keySignIn;
    if (status === 403) return m.keyVerifyEmail;
    if (status === 429) return m.keyRateLimited;
    if (status === 503) return serverMessage === "MCP is not enabled" ? m.keyMcpDisabled : m.keyStorageError;
    return fallback;
  }, [m]);

  const loadCredentials = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/api-key", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCredentialsError(getKeyFailureMessage(response.status, data.error, m.credentialsLoadError));
        return;
      }
      setCredentials(data.credentials ?? []);
      setCredentialsError("");
    } catch {
      setCredentialsError(m.credentialsLoadError);
    }
  }, [getKeyFailureMessage, m]);

  useEffect(() => {
    if (!isActive) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/auth/api-key", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          setCredentialsError(getKeyFailureMessage(response.status, data.error, m.credentialsLoadError));
          return;
        }
        setCredentials(data.credentials ?? []);
        setCredentialsError("");
      } catch {
        if (active) setCredentialsError(m.credentialsLoadError);
      }
    };
    void load();
    return () => { active = false; };
  }, [getKeyFailureMessage, isActive, m]);

  useEffect(() => {
    if (!isActive) return;
    const controller = new AbortController();
    const checkReadiness = async () => {
      try {
        const endpointUrl = `${window.location.origin}/api/mcp`;
        const options = { cache: "no-store" as const, signal: controller.signal };
        const [authorizationResponse, resourceResponse, endpointResponse, statusResponse] = await Promise.all([
          fetch("/.well-known/oauth-authorization-server", options),
          fetch("/.well-known/oauth-protected-resource/api/mcp", options),
          fetch("/api/mcp", options),
          fetch("/api/mcp/status", options),
        ]);
        const authorization: unknown = authorizationResponse.ok ? await authorizationResponse.json() : null;
        const resource: unknown = resourceResponse.ok ? await resourceResponse.json() : null;
        if (!controller.signal.aborted) {
          setReadiness(statusResponse.ok && isMcpEndpointReady(
            endpointUrl,
            authorization,
            resource,
            endpointResponse.status,
            endpointResponse.headers.get("www-authenticate"),
          ) ? "ready" : "unavailable");
        }
      } catch {
        if (!controller.signal.aborted) setReadiness("unavailable");
      }
    };
    void checkReadiness();
    return () => controller.abort();
  }, [isActive]);

  const handleCopy = async (value: string, type: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(null);
      setCopiedConfig(type);
      setTimeout(() => setCopiedConfig(current => current === type ? null : current), 2000);
    } catch {
      setCopyError(type);
    }
  };

  const handleGenerateApiKey = async () => {
    setIsGeneratingKey(true);
    setKeyError("");
    try {
      const response = await fetch("/api/auth/api-key", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setKeyError(getKeyFailureMessage(response.status, data.error, m.keyCreateError));
        return;
      }
      setApiKey(data.token);
      await loadCredentials();
    } catch {
      setKeyError(m.keyCreateError);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    setKeyError("");
    try {
      const response = await fetch("/api/auth/api-key", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setKeyError(getKeyFailureMessage(response.status, data.error, m.keyRevokeError));
        return;
      }
      setApiKey("");
      await loadCredentials();
    } catch {
      setKeyError(m.keyRevokeError);
    }
  };

  const mcpServerUrl = `${typeof window === "undefined" ? "https://your-nota-domain.example" : window.location.origin}/api/mcp`;
  const oauthConfig = JSON.stringify({ mcpServers: { "nota-vault": { url: mcpServerUrl } } }, null, 2);
  const claudeConfig = JSON.stringify({
    mcpServers: {
      "nota-vault": {
        command: "node",
        args: ["/absolute/path/to/nota/mcp-server/index.js"],
        env: { NOTA_API_KEY: apiKey || "PASTE_YOUR_MCP_KEY" },
      },
    },
  }, null, 2);
  const cursorConfig = JSON.stringify({
    mcpServers: {
      "nota-vault": {
        url: mcpServerUrl,
        headers: { Authorization: `Bearer ${apiKey || "PASTE_YOUR_MCP_KEY"}` },
      },
    },
  }, null, 2);
  const manualConfigText = manualConfigTab === "claude" ? claudeConfig : cursorConfig;
  const cursorInstallUrl = createCursorInstallUrl(mcpServerUrl);
  const isLocalMcpUrl = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(mcpServerUrl).hostname);

  return (
    <div className="space-y-6 max-w-3xl">
      <h3 className="text-base font-semibold text-neutral-100">MCP</h3>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{m.mcpUrl}</h4>
          <span role="status" className={`text-xs ${readiness === "ready" ? "text-emerald-400" : "text-neutral-400"}`}>
            {readiness === "checking" ? m.checking : readiness === "ready" ? m.endpointReady : m.endpointUnavailable}
          </span>
        </div>
        <code className="block w-full overflow-x-auto whitespace-nowrap rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-neutral-200 select-all">{mcpServerUrl}</code>
        <button type="button" onClick={() => void handleCopy(mcpServerUrl, "mcp-url")} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-100 hover:bg-neutral-700">
          {copiedConfig === "mcp-url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedConfig === "mcp-url" ? m.copied : m.copyUrl}
        </button>
        {readiness === "unavailable" && <p className="text-xs text-amber-300">{m.endpointNotReady}</p>}
        {isLocalMcpUrl && <p className="text-xs text-amber-300">{m.remoteUrlRequired}</p>}
        {(copyError === "mcp-url" || copyError === "oauth-config") && <p role="alert" className="text-xs text-red-300">{m.copyFailed}</p>}

        <div className="divide-y divide-neutral-800 border-t border-neutral-800">
          <div className="space-y-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-sm font-medium text-neutral-100">Cursor</h5>
              {readiness === "ready" ? (
                <a href={cursorInstallUrl} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500">{m.addToCursor} <ExternalLink className="w-3.5 h-3.5" /></a>
              ) : (
                <button type="button" disabled className="rounded-md bg-neutral-800 px-3 py-2 text-xs text-neutral-500">{m.addToCursor}</button>
              )}
            </div>
            <p className="text-xs leading-relaxed text-neutral-400">{m.cursorInstructions}</p>
            <p className="text-xs leading-relaxed text-neutral-400">{m.cursorSetupNote} <button type="button" onClick={() => void handleCopy(oauthConfig, "oauth-config")} className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200">{copiedConfig === "oauth-config" ? m.copiedJson : m.copyJson}</button></p>
          </div>
          <div className="space-y-2 py-4">
            <h5 className="text-sm font-medium text-neutral-100">Claude</h5>
            <p className="text-xs leading-relaxed text-neutral-400">{m.claudeInstructions}</p>
            <p className="text-xs leading-relaxed text-neutral-400">{m.claudeWorkspaceNote} · <a href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200">{m.claudeGuide}</a></p>
          </div>
          <div className="space-y-2 py-4">
            <h5 className="text-sm font-medium text-neutral-100">ChatGPT</h5>
            <p className="text-xs leading-relaxed text-neutral-400">{m.chatgptInstructions}</p>
            <p className="text-xs leading-relaxed text-neutral-400">{m.chatgptAvailabilityNote} · <a href="https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt" target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200">{m.chatgptGuide}</a></p>
          </div>
        </div>
      </section>

      <div className="border-t border-neutral-800 pt-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5"><Key className="w-4 h-4 text-neutral-400" /><span className="text-sm font-semibold text-neutral-200">{m.manualKeys}</span></div>
          <button type="button" onClick={handleGenerateApiKey} disabled={isGeneratingKey} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 border border-neutral-700 shrink-0">
            {isGeneratingKey ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>{m.creatingKey}</span></> : m.createKey}
          </button>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">{m.manualKeyDescription}</p>
        <details className="border-t border-neutral-800 pt-3">
          <summary className="cursor-pointer text-xs text-neutral-300">{m.manualConfig}</summary>
          <div className="space-y-2 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                {(["cursor", "claude"] as const).map((configTab) => (
                  <button key={configTab} type="button" onClick={() => setManualConfigTab(configTab)} aria-pressed={manualConfigTab === configTab} className={`rounded px-2 py-1 text-xs ${manualConfigTab === configTab ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"}`}>
                    {configTab === "cursor" ? m.cursorHttp : m.claudeStdio}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void handleCopy(manualConfigText, "manual-config")} className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white">
                {copiedConfig === "manual-config" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedConfig === "manual-config" ? m.copiedConfig : m.copyConfig}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-900 p-3 font-mono text-xs text-neutral-300">{manualConfigText}</pre>
          </div>
        </details>
        {(copyError === "manual-config" || copyError === "mcp-key") && <p role="alert" className="text-xs text-red-300">{m.copyFailed}</p>}
        {keyError && <p role="alert" className="text-xs text-red-300">{keyError}</p>}
        {credentialsError && <p role="alert" className="text-xs text-red-300">{credentialsError}</p>}
        {apiKey && (
          <div className="flex items-center gap-3 p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg">
            <span className="font-mono text-xs text-neutral-200 truncate flex-1 select-all">{apiKey}</span>
            <button type="button" onClick={() => void handleCopy(apiKey, "mcp-key")} className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 rounded text-xs font-mono transition-colors shrink-0 cursor-pointer">{copiedConfig === "mcp-key" ? m.copiedKey : m.copyKey}</button>
          </div>
        )}
        {credentials.filter((item) => !item.revokedAt).map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs text-neutral-400">
            <span>{m.createdExpires(new Date(item.createdAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US"), new Date(item.expiresAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US"))}</span>
            <button type="button" onClick={() => void handleRevokeKey(item.id)} className="text-red-300 hover:text-red-200">{m.revoke}</button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{lang === "th" ? "เครื่องมือ MCP" : "MCP tools"}</h4>
        <div className="border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800 bg-neutral-950/40">
          {MCP_TOOLS.map((tool) => (
            <div key={tool.name} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <code className="text-xs font-mono font-bold text-neutral-200">{tool.name}</code>
                <span className="text-neutral-400 text-xs truncate max-w-md hidden sm:inline">{tool.desc[lang]}</span>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 bg-neutral-800 text-neutral-300 border-neutral-700">
                {lang === "th" ? ({ Read: "อ่าน", Write: "เขียน", Share: "แชร์", Maintenance: "ดูแลระบบ" }[tool.category]) : tool.category}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
