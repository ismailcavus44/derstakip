import { redirect } from "next/navigation";

import { AdminNav } from "@/app/admin/admin-nav";
import { getCachedAuth } from "@/lib/auth/cached-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCachedAuth();

  if (!user) {
    redirect("/login");
  }

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const displayName = profile.full_name?.trim() || "Yönetici";

  return (
    <div className="min-h-screen w-full bg-background">
      <AdminNav displayName={displayName} />
      {children}
    </div>
  );
}
