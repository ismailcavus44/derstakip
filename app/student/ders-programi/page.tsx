import { CalendarRange } from "lucide-react";
import { redirect } from "next/navigation";

import {
  DersProgramiCalendar,
  type ScheduleEntryVM,
  type ScheduleTaskOption,
} from "@/app/student/ders-programi/ders-programi-calendar";
import { StudentAppHeader } from "@/components/student-app-header";
import { getCachedAuth } from "@/lib/auth/cached-auth";

export const dynamic = "force-dynamic";

function taskFieldsFromJoin(
  row: { title?: string; description?: string | null; status?: string } | { title?: string; description?: string | null; status?: string }[] | null | undefined
): { title: string; description: string | null; status: string } {
  if (!row) {
    return { title: "Görev", description: null, status: "pending" };
  }
  const o = Array.isArray(row) ? row[0] : row;
  const title =
    typeof o?.title === "string" && o.title.trim() ? o.title.trim() : "Görev";
  const description =
    typeof o?.description === "string" ? o.description : null;
  const status =
    typeof o?.status === "string" && o.status ? o.status : "pending";
  return { title, description, status };
}

export default async function DersProgramiPage() {
  const { user, profile, supabase } = await getCachedAuth();

  if (!user) {
    redirect("/login");
  }

  const displayName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "Öğrenci";

  const [taskRes, entRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_schedule_entries")
      .select(
        "id, task_id, scheduled_date, start_minutes, end_minutes, tasks(title, description, status)"
      )
      .eq("student_id", user.id)
      .order("scheduled_date", { ascending: true })
      .order("start_minutes", { ascending: true }),
  ]);

  const taskRows = taskRes.data;

  const tasks: ScheduleTaskOption[] =
    (taskRows ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
    })) ?? [];

  let entries: ScheduleEntryVM[] = [];
  let migrationHint: string | null = null;

  if (entRes.error) {
    const msg = entRes.error.message?.toLowerCase() ?? "";
    if (
      msg.includes("student_schedule_entries") ||
      msg.includes("does not exist") ||
      msg.includes("scheduled_date") ||
      msg.includes("start_minutes") ||
      entRes.error.code === "42P01"
    ) {
      migrationHint =
        "Program şeması güncel değil. Supabase’de supabase/student-schedule.sql dosyasını çalıştırın (saat sütunları için tablo yenilenir).";
    }
  } else {
    entries =
      (entRes.data ?? []).map((row) => {
        const r = row as {
          id: string;
          task_id: string;
          scheduled_date: string;
          start_minutes: number;
          end_minutes: number;
          tasks: unknown;
        };
        const tf = taskFieldsFromJoin(
          r.tasks as {
            title?: string;
            description?: string | null;
            status?: string;
          } | null
        );
        return {
          id: r.id,
          task_id: r.task_id,
          scheduled_date: r.scheduled_date,
          start_minutes: r.start_minutes,
          end_minutes: r.end_minutes,
          task_title: tf.title,
          task_description: tf.description,
          task_status: tf.status,
        };
      }) ?? [];
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <StudentAppHeader displayName={displayName} active="program" />

      <main className="mx-auto flex min-w-0 w-full max-w-5xl flex-1 flex-col gap-5 px-4 pb-12 pt-5 sm:gap-6 sm:px-6 sm:pt-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-sm ring-1 ring-primary/25 sm:size-10">
            <CalendarRange className="size-[1.2rem] sm:size-[1.35rem]" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="min-w-0 text-lg font-semibold tracking-tight text-foreground sm:text-xl md:text-2xl">
            Ders programı
          </h1>
        </div>

        <DersProgramiCalendar
          tasks={tasks}
          entries={entries}
          migrationHint={migrationHint}
        />
      </main>
    </div>
  );
}
