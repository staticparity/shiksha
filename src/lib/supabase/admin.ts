import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — never expose to the client,
 * never import outside server-only code paths (API routes). Used to
 * provision student accounts a tutor creates directly (no self-signup),
 * via auth.admin.createUser().
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
