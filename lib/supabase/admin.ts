import { createClient } from "@supabase/supabase-js";

/**
 * Yalnızca sunucuda (Server Action / Route Handler). Service role RLS'i aşar.
 * Öğrenci oluşturma / silme ve listeler için kullanılır.
 */
export function createServerAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL eksik.");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY eksik (Supabase Dashboard → Settings → API).");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
