import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/** Aynı RSC isteğinde layout + sayfa + server fonksiyonları tekrar çağırsa bile tek getUser + tek profil sorgusu */
export const getCachedAuth = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null as { role: string; full_name: string | null } | null,
      supabase,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    profile: profile as { role: string; full_name: string | null } | null,
    supabase,
  };
});
