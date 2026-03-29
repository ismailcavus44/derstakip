import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";

import { getCurriculumTree } from "@/app/curriculum/actions";
import { StudentQuestionUploadButton } from "@/app/student/student-question-upload-button";
import { StudentTasksPanel } from "@/app/student/student-tasks-panel";
import { StudentAppHeader } from "@/components/student-app-header";
import { getCachedAuth } from "@/lib/auth/cached-auth";

function isMissingColumnError(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes("column") && m.includes("does not exist");
}

export default async function StudentPage() {
  const { user, profile, supabase } = await getCachedAuth();

  if (!user) {
    redirect("/login");
  }

  const taskFieldsCore = `
      id,
      title,
      description,
      status,
      created_at,
      topic_id,
      subject_id,
      task_kind,
      question_count,
      followup_question_count`;
  const denemeFields = `,
      deneme_branch,
      deneme_target_minutes,
      deneme_correct,
      deneme_wrong,
      deneme_actual_minutes`;
  const topicsJoin = `,
      topics ( name, subjects ( name ) )`;
  const subjectEmbed = `,
      subjects ( name )`;
  const legacySelect =
    "id, title, description, status, created_at";

  type TaskQueryRow = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    topic_id?: string | null;
    subject_id?: string | null;
    task_kind?: string | null;
    question_count?: number | null;
    followup_question_count?: number | null;
    deneme_branch?: string | null;
    deneme_target_minutes?: number | null;
    deneme_correct?: number | null;
    deneme_wrong?: number | null;
    deneme_actual_minutes?: number | null;
    topics?: unknown;
    subjects?: unknown;
  };

  const curriculum = await getCurriculumTree();

  const studentTaskSelectCandidates = [
    `${taskFieldsCore}${denemeFields}${topicsJoin}${subjectEmbed}`,
    `${taskFieldsCore}${denemeFields}${topicsJoin}`,
    `${taskFieldsCore}${topicsJoin}${subjectEmbed}`,
    `${taskFieldsCore}${topicsJoin}`,
    legacySelect,
  ];

  let tasks: TaskQueryRow[] | null = null;
  for (const sel of studentTaskSelectCandidates) {
    const res = await supabase
      .from("tasks")
      .select(sel)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });
    if (!res.error) {
      tasks = (res.data ?? null) as unknown as TaskQueryRow[] | null;
      break;
    }
    if (!isMissingColumnError(res.error)) {
      break;
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
        deneme_branch?: string | null;
        deneme_target_minutes?: number | null;
        deneme_correct?: number | null;
        deneme_wrong?: number | null;
        deneme_actual_minutes?: number | null;
        topics?: unknown;
        subjects?: unknown;
        subject_id?: string | null;
      };
      const tr = (Array.isArray(row.topics) ? row.topics[0] : row.topics) as {
        name: string;
        subjects: { name: string } | { name: string }[] | null;
      } | null;
      const subj = tr?.subjects;
      const subjectFromTopic = Array.isArray(subj)
        ? subj[0]?.name ?? null
        : subj?.name ?? null;
      const directSub = (
        Array.isArray(row.subjects) ? row.subjects[0] : row.subjects
      ) as { name: string } | null;
      const subjectName =
        directSub?.name?.trim() || subjectFromTopic || null;
      const kind = row.task_kind as
        | "soru_cozumu"
        | "konu_anlatimi"
        | "deneme_sinavi"
        | null;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status as "pending" | "completed",
        created_at: row.created_at,
        task_kind: kind,
        question_count: row.question_count ?? null,
        followup_question_count: row.followup_question_count ?? null,
        deneme_branch: row.deneme_branch ?? null,
        deneme_target_minutes: row.deneme_target_minutes ?? null,
        deneme_correct: row.deneme_correct ?? null,
        deneme_wrong: row.deneme_wrong ?? null,
        deneme_actual_minutes: row.deneme_actual_minutes ?? null,
        subject_id: row.subject_id ?? null,
        subject_name: subjectName,
        topic_name: tr?.name ?? null,
      };
    }) ?? [];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <StudentAppHeader displayName={displayName} active="tasks" />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-sm ring-1 ring-primary/25">
              <ClipboardList className="size-[1.35rem]" strokeWidth={1.75} aria-hidden />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Görevlerin
            </h1>
          </div>
          <StudentQuestionUploadButton
            subjects={curriculum.subjects}
            topics={curriculum.topics}
          />
        </div>

        <StudentTasksPanel tasks={taskRows} topics={curriculum.topics} />
      </main>
    </div>
  );
}
