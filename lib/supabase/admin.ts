import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Öğrenciye görev maili için: auth.users e-postası (service role yoksa null).
 * createServerAdminClient gibi fırlatmaz.
 */
export async function getAuthUserEmailById(
  userId: string
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const id = userId.trim();
  if (!url || !key || !id) return null;

  try {
    const supabase: SupabaseClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error) return null;
    const em = data.user?.email?.trim();
    return em || null;
  } catch {
    return null;
  }
}

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
