import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  if (process.env.NODE_ENV === "production") {
    console.warn("Supabase environment variables are missing!");
  }
}

// Server-side client with full service privileges
export const supabaseAdmin = createClient(supabaseUrl || "", supabaseServiceKey || "", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
