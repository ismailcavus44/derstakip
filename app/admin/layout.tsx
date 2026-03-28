import { redirect } from "next/navigation";

import { AdminNav } from "@/app/admin/admin-nav";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
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
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  const displayName = profile?.full_name?.trim() || "Yönetici";

  return (
    <div className="min-h-screen w-full bg-background">
      <AdminNav displayName={displayName} />
      {children}
    </div>
  );
}
