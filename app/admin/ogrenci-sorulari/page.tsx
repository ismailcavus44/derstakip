import { getAdminQuestionSubmissions } from "@/app/admin/actions";
import { AdminOgrenciSorulariClient } from "@/app/admin/ogrenci-sorulari/admin-ogrenci-sorulari-client";

export default async function AdminOgrenciSorulariPage() {
  const rows = await getAdminQuestionSubmissions();
  return <AdminOgrenciSorulariClient rows={rows} />;
}
