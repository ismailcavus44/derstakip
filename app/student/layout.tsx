import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCachedAuth } from "@/lib/auth/cached-auth";

export const dynamic = "force-dynamic";

export default async function StudentLayout({
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
