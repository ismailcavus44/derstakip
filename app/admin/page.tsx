import { getAdminDashboardData } from "@/app/admin/actions";
import { AdminPanel } from "@/app/admin/admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await getAdminDashboardData();

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-xl font-bold">Yönetici paneli</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Veri yüklenemedi.{" "}
          <code className="rounded bg-muted px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          .env içinde tanımlı mı kontrol edin (Supabase → Settings → API → service_role).
        </p>
      </div>
    );
  }

  return (
    <AdminPanel teachers={data.teachers} students={data.students} />
  );
}
