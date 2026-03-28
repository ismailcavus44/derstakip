import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "teacher") redirect("/teacher");
    if (profile?.role === "student") redirect("/student");
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      {/* Arka plan */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-50/90 via-background to-background dark:from-emerald-950/25 dark:via-background dark:to-background"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(16,185,129,0.18),transparent_55%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(52,211,153,0.12),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[min(50vh,420px)] w-[min(100%,720px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.04),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent_70%)]"
        aria-hidden
      />

      <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
        <LoginForm />
      </div>
    </div>
  );
}
