import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./env";

// The project does not yet contain generated Supabase Database types. Keep the
// untyped boundary isolated here rather than leaking environment fallbacks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any;

/** Server-only privileged client. Never import this from client components. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): any {
  if (!client) {
    const { url, serviceRoleKey } = getSupabaseConfig();
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
