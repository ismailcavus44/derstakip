import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/login");
  }

  if (profile.role === "teacher") {
    redirect("/teacher");
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  if (profile.role !== "student") {
    redirect("/login");
  }

  return (
    <AppShell variant="student">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col">
        {children}
      </div>
    </AppShell>
  );
}
