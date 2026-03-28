import { redirect } from "next/navigation";

import { TeacherNav } from "@/app/teacher/teacher-nav";
import { AppShell } from "@/components/app-shell";
import { getCachedAuth } from "@/lib/auth/cached-auth";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCachedAuth();

  if (!user) {
    redirect("/login");
  }

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "student") {
    redirect("/student");
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  if (profile.role !== "teacher") {
    redirect("/login");
  }

  const displayName = profile.full_name?.trim() || "Öğretmen";

  return (
    <AppShell variant="teacher">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col">
        <TeacherNav displayName={displayName} />
        {children}
      </div>
    </AppShell>
  );
}
