import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";

import { StudentTasksPanel } from "@/app/student/student-tasks-panel";
import { StudentAppHeader } from "@/components/student-app-header";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isMissingColumnError(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes("column") && m.includes("does not exist");
}

export default async function StudentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullSelect = `
      id,
      title,
      description,
      status,
      created_at,
      topic_id,
      task_kind,
      question_count,
      followup_question_count,
      topics ( name, subjects ( name ) )
    `;
  const legacySelect =
    "id, title, description, status, created_at";

  type TaskQueryRow = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    topic_id?: string | null;
    task_kind?: string | null;
    question_count?: number | null;
    followup_question_count?: number | null;
    topics?: unknown;
  };

  const res1 = await supabase
    .from("tasks")
    .select(fullSelect)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  let tasks: TaskQueryRow[] | null = !res1.error
    ? ((res1.data ?? null) as TaskQueryRow[] | null)
    : null;
  if (res1.error && isMissingColumnError(res1.error)) {
    const res2 = await supabase
      .from("tasks")
      .select(legacySelect)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });
    if (!res2.error) {
      tasks = (res2.data ?? null) as TaskQueryRow[] | null;
    }
  }

  const displayName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "Öğrenci";

  const taskRows =
    tasks?.map((t) => {
      const row = t as {
        id: string;
        title: string;
        description: string | null;
        status: string;
        created_at: string;
        task_kind?: string | null;
        question_count?: number | null;
        followup_question_count?: number | null;
        topics?: unknown;
      };
      const tr = (Array.isArray(row.topics) ? row.topics[0] : row.topics) as {
        name: string;
        subjects: { name: string } | { name: string }[] | null;
      } | null;
      const subj = tr?.subjects;
      const subjectName = Array.isArray(subj)
        ? subj[0]?.name ?? null
        : subj?.name ?? null;
      const kind = row.task_kind as "soru_cozumu" | "konu_anlatimi" | null;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status as "pending" | "completed",
        created_at: row.created_at,
        task_kind: kind,
        question_count: row.question_count ?? null,
        followup_question_count: row.followup_question_count ?? null,
        subject_name: subjectName,
        topic_name: tr?.name ?? null,
      };
    }) ?? [];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <StudentAppHeader displayName={displayName} active="tasks" />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-sm ring-1 ring-primary/25">
            <ClipboardList className="size-[1.35rem]" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Görevlerin
          </h1>
        </div>

        <StudentTasksPanel tasks={taskRows} />
      </main>
    </div>
  );
}
