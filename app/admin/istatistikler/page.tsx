import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminIstatistiklerTables } from "@/app/admin/admin-istatistikler-client";
import { getAdminDashboardData, getAdminStudentStats } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

type PageProps = {
  searchParams?: Promise<{ ogrenci?: string }>;
};

export default async function AdminIstatistiklerPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const dash = await getAdminDashboardData();
  if (!dash) redirect("/");

  const rawFilter = sp.ogrenci?.trim();
  const validIds = new Set(dash.students.map((s) => s.id));
  if (rawFilter && !validIds.has(rawFilter)) {
    redirect("/admin/istatistikler");
  }
  const filterStudentId = rawFilter && validIds.has(rawFilter) ? rawFilter : null;

  const data = await getAdminStudentStats(filterStudentId ?? undefined);
  if (!data) redirect("/");

  const { completions, questionStats, tablesMissing } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Öğrenci istatistikleri</h1>
        <p className="text-sm text-muted-foreground">
          Konu anlatımı tamamlamaları ve konu bazlı soru çözüm toplamları. Silme işlemleri
          yalnızca yönetici içindir; öğrenci bazlı filtreleyebilirsiniz.
        </p>
      </div>

      <div className="mb-6 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Öğrenciye göre filtre
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/istatistikler"
            scroll={false}
            className={cn(
              "inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              filterStudentId === null
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/80 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
            )}
          >
            Tümü
          </Link>
          {dash.students.map((s) => {
            const active = s.id === filterStudentId;
            return (
              <Link
                key={s.id}
                href={`/admin/istatistikler?ogrenci=${s.id}`}
                scroll={false}
                className={cn(
                  "inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/80 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="truncate">{s.full_name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <AdminIstatistiklerTables
        completions={completions}
        questionStats={questionStats}
        tablesMissing={tablesMissing}
      />
    </div>
  );
}
