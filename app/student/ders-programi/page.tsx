import { CalendarRange } from "lucide-react";
import { redirect } from "next/navigation";

import { getCurriculumTree } from "@/app/curriculum/actions";
import {
  DersProgramiCalendar,
  type ScheduleEntryVM,
  type ScheduleTaskOption,
} from "@/app/student/ders-programi/ders-programi-calendar";
import { StudentAppHeader } from "@/components/student-app-header";
import { getCachedAuth } from "@/lib/auth/cached-auth";

function isMissingColumnError(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes("column") && m.includes("does not exist");
}

function taskFieldsFromJoin(row: unknown): {
  title: string;
  description: string | null;
  status: string;
  task_kind: string | null;
  task_subject_id: string | null;
  deneme_target_minutes: number | null;
  deneme_correct: number | null;
  deneme_wrong: number | null;
  deneme_actual_minutes: number | null;
} {
  if (row == null) {
    return {
      title: "Görev",
      description: null,
      status: "pending",
      task_kind: null,
      task_subject_id: null,
      deneme_target_minutes: null,
      deneme_correct: null,
      deneme_wrong: null,
      deneme_actual_minutes: null,
    };
  }
  const o = Array.isArray(row) ? row[0] : row;
  if (!o || typeof o !== "object") {
    return {
      title: "Görev",
      description: null,
      status: "pending",
      task_kind: null,
      task_subject_id: null,
      deneme_target_minutes: null,
      deneme_correct: null,
      deneme_wrong: null,
      deneme_actual_minutes: null,
    };
  }
  const rec = o as Record<string, unknown>;
  const title =
    typeof rec.title === "string" && rec.title.trim()
      ? rec.title.trim()
      : "Görev";
  const description =
    typeof rec.description === "string" ? rec.description : null;
  const status =
    typeof rec.status === "string" && rec.status ? rec.status : "pending";
  const task_kind =
    typeof rec.task_kind === "string" && rec.task_kind
      ? rec.task_kind
      : null;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const sid = rec.subject_id;
  const task_subject_id =
    typeof sid === "string" && /^[0-9a-f-]{36}$/i.test(sid.trim())
      ? sid.trim()
      : null;
  return {
    title,
    description,
    status,
    task_kind,
    task_subject_id,
    deneme_target_minutes: num(rec.deneme_target_minutes),
    deneme_correct: num(rec.deneme_correct),
    deneme_wrong: num(rec.deneme_wrong),
    deneme_actual_minutes: num(rec.deneme_actual_minutes),
  };
}

export default async function DersProgramiPage() {
  const { user, profile, supabase } = await getCachedAuth();

  if (!user) {
    redirect("/login");
  }

  const displayName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "Öğrenci";

  const curriculum = await getCurriculumTree();

  const scheduleSelectFull =
    "id, task_id, scheduled_date, start_minutes, end_minutes, tasks(title, description, status, task_kind, subject_id, deneme_target_minutes, deneme_correct, deneme_wrong, deneme_actual_minutes, subjects(name))";
  const scheduleSelectMid =
    "id, task_id, scheduled_date, start_minutes, end_minutes, tasks(title, description, status, task_kind, deneme_target_minutes, deneme_correct, deneme_wrong, deneme_actual_minutes)";

  const [taskRes, entResFirst] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_schedule_entries")
      .select(scheduleSelectFull)
      .eq("student_id", user.id)
      .order("scheduled_date", { ascending: true })
      .order("start_minutes", { ascending: true }),
  ]);

  let entRes = entResFirst;
  if (entRes.error && isMissingColumnError(entRes.error)) {
    const retry = await supabase
      .from("student_schedule_entries")
      .select(scheduleSelectMid)
      .eq("student_id", user.id)
      .order("scheduled_date", { ascending: true })
      .order("start_minutes", { ascending: true });
    if (!retry.error) {
      entRes = retry as typeof entResFirst;
    }
  }

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
        const tf = taskFieldsFromJoin(r.tasks);
        return {
          id: r.id,
          task_id: r.task_id,
          scheduled_date: r.scheduled_date,
          start_minutes: r.start_minutes,
          end_minutes: r.end_minutes,
          task_title: tf.title,
          task_description: tf.description,
          task_status: tf.status,
          task_kind: tf.task_kind,
          task_subject_id: tf.task_subject_id,
          deneme_target_minutes: tf.deneme_target_minutes,
          deneme_correct: tf.deneme_correct,
          deneme_wrong: tf.deneme_wrong,
          deneme_actual_minutes: tf.deneme_actual_minutes,
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
          topics={curriculum.topics}
          migrationHint={migrationHint}
        />
      </main>
    </div>
  );
}
