"use server";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { ADMIN_USER_ID } from "@/lib/auth/admin";
import { createServerActionClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error?: string;
};

function resolveRole(user: User): "teacher" | "student" | "admin" {
  if (user.id === ADMIN_USER_ID) return "admin";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const r = meta?.role;
  if (r === "teacher" || r === "student" || r === "admin") return r;
  const mail = user.email?.toLowerCase() ?? "";
  if (mail === "admin@admin.com") return "teacher";
  if (mail === "elif@elif.com") return "student";
  return "student";
}

function resolveFullName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const n = meta?.full_name;
  if (typeof n === "string" && n.trim()) return n.trim();
  return user.email?.split("@")[0] ?? "";
}

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { error: "E-posta ve şifre gereklidir." };
  }

  const supabase = await createServerActionClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: signInError.message };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Oturum alınamadı." };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  let profile = profileData;

  if (profileError) {
    await supabase.auth.signOut();
    return { error: profileError.message };
  }

  if (!profile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      role: resolveRole(user),
      full_name: resolveFullName(user),
      teacher_id: null,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: again, error: againError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (againError || !again) {
          await supabase.auth.signOut();
          return { error: insertError.message };
        }
        profile = again;
      } else {
        await supabase.auth.signOut();
        return { error: `Profil oluşturulamadı: ${insertError.message}` };
      }
    } else {
      const { data: created, error: readError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (readError || !created) {
        await supabase.auth.signOut();
        return { error: readError?.message ?? "Profil okunamadı." };
      }
      profile = created;
    }
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  if (profile.role === "teacher") {
    redirect("/teacher");
  }

  if (profile.role === "student") {
    redirect("/student");
  }

  await supabase.auth.signOut();
  return { error: "Geçersiz kullanıcı rolü." };
}
