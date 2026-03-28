import { redirect } from "next/navigation";

import { TeacherNav } from "@/app/teacher/teacher-nav";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherLayout({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role === "student") {
    redirect("/student");
  }

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  if (profile?.role !== "teacher") {
    redirect("/login");
  }

  const displayName = profile?.full_name?.trim() || "Öğretmen";

  return (
    <AppShell variant="teacher">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col">
        <TeacherNav displayName={displayName} />
        {children}
      </div>
    </AppShell>
  );
}
