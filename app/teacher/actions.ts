"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { getCachedAuth } from "@/lib/auth/cached-auth";
import { sendTaskAssignedEmail } from "@/lib/email/send-task-assigned-email";
import { resolveTaskNotificationEmail } from "@/lib/email/student-notify-email";
import {
  MAX_QUESTION_ANSWER_BYTES,
  QUESTION_ANSWER_ALLOWED_TYPES,
  QUESTION_ANSWER_BUCKET,
  QUESTION_ANSWER_SIGNED_URL_SEC,
} from "@/lib/student-question-answers";
import {
  STUDENT_QUESTION_BUCKET,
  STUDENT_QUESTION_SIGNED_URL_SEC,
} from "@/lib/student-question-uploads";
import { denemeBranchAndTargetFromSubjectSlug } from "@/lib/deneme-exam";
import { parseQuestionIssueKind, type QuestionIssueKind } from "@/lib/question-issue-kind";
import { createServerActionClient } from "@/lib/supabase/server";

export type StudentRow = {
  id: string;
  full_name: string;
};

export type TaskWithStudent = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "completed";
  created_at: string;
  student_id: string;
  student_name: string;
  topic_id: string | null;
  subject_id: string | null;
  task_kind: "soru_cozumu" | "konu_anlatimi" | "deneme_sinavi" | null;
  question_count: number | null;
  followup_question_count: number | null;
  deneme_branch: string | null;
  deneme_target_minutes: number | null;
  deneme_correct: number | null;
  deneme_wrong: number | null;
  deneme_actual_minutes: number | null;
  subject_name: string | null;
  topic_name: string | null;
};

/** curriculum-and-progress.sql uygulanmadan tasks’ta ek kolonlar yoksa */
function isMissingColumnError(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes("column") && m.includes("does not exist");
}

function isMissingTableError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  const code = err.code ?? "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

const DEFAULT_FOLLOWUP_QUESTIONS = 20;

async function decrementTopicQuestionsSolved(
  supabase: Awaited<ReturnType<typeof createServerActionClient>>,
  studentId: string,
  topicId: string,
  sub: number
) {
  const n =
    typeof sub === "number" && Number.isFinite(sub) && sub > 0
      ? Math.floor(sub)
      : 0;
  if (n <= 0) return;

  const { data: existing } = await supabase
    .from("student_topic_question_stats")
    .select("questions_solved")
    .eq("student_id", studentId)
    .eq("topic_id", topicId)
    .maybeSingle();

  if (!existing) return;

  const next = Math.max(0, (existing.questions_solved ?? 0) - n);
  if (next === 0) {
    const { error: dErr } = await supabase
      .from("student_topic_question_stats")
      .delete()
      .eq("student_id", studentId)
      .eq("topic_id", topicId);
    if (dErr) console.error("decrementTopicQuestionsSolved delete:", dErr.message);
  } else {
    const { error: uErr } = await supabase
      .from("student_topic_question_stats")
      .update({ questions_solved: next })
      .eq("student_id", studentId)
      .eq("topic_id", topicId);
    if (uErr) console.error("decrementTopicQuestionsSolved update:", uErr.message);
  }
}

/** Tamamlanmış görev silinirken completeTask ile eklenen ilerlemeyi geri alır */
async function revertStudentProgressForDeletedTask(
  supabase: Awaited<ReturnType<typeof createServerActionClient>>,
  task: {
    id: string;
    student_id: string;
    topic_id: string | null;
    status: string;
    task_kind: string | null;
    question_count: number | null;
    followup_question_count: number | null;
  }
) {
  if (task.status !== "completed" || !task.topic_id) return;
  if (task.task_kind === "deneme_sinavi") return;

  const topicId = task.topic_id;
  const studentId = task.student_id;
  const kind =
    task.task_kind === "konu_anlatimi" ? "konu_anlatimi" : "soru_cozumu";

  if (kind === "konu_anlatimi") {
    const { data: removed, error: delErr } = await supabase
      .from("student_topic_completions")
      .delete()
      .eq("task_id", task.id)
      .eq("student_id", studentId)
      .select("student_id");

    if (delErr) {
      console.error("revertStudentProgressForDeletedTask completions:", delErr.message);
      return;
    }

    if (removed && removed.length > 0) {
      const followup =
        typeof task.followup_question_count === "number" &&
        Number.isFinite(task.followup_question_count) &&
        task.followup_question_count >= 0
          ? Math.floor(task.followup_question_count)
          : DEFAULT_FOLLOWUP_QUESTIONS;

      await decrementTopicQuestionsSolved(supabase, studentId, topicId, followup);
    }
  } else {
    await decrementTopicQuestionsSolved(
      supabase,
      studentId,
      topicId,
      task.question_count ?? 0
    );
  }
}

export async function getStudents(): Promise<StudentRow[]> {
  const { user, supabase } = await getCachedAuth();

  if (!user) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "student")
    .eq("teacher_id", user.id)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("getStudents:", error.message);
    return [];
  }

  return data ?? [];
}

export async function getTasks(): Promise<TaskWithStudent[]> {
  const { user, supabase } = await getCachedAuth();

  if (!user) return [];

  const coreSelect =
    "id, title, description, status, created_at, student_id, topic_id, task_kind, question_count, followup_question_count";
  const denemeSuffix =
    ", deneme_branch, deneme_target_minutes, deneme_correct, deneme_wrong, deneme_actual_minutes";
  const subjectSuffix = ", subject_id";
  const legacySelect =
    "id, title, description, status, created_at, student_id";

  type TaskRowDb = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    student_id: string;
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
  };

  const selectCandidates = [
    coreSelect + subjectSuffix + denemeSuffix,
    coreSelect + denemeSuffix,
    coreSelect + subjectSuffix,
    coreSelect,
    legacySelect,
  ];

  let tasks: TaskRowDb[] | null = null;
  let tasksError: { message?: string } | null = null;

  for (const sel of selectCandidates) {
    const res = await supabase
      .from("tasks")
      .select(sel)
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    if (!res.error) {
      tasks = res.data as unknown as TaskRowDb[] | null;
      tasksError = null;
      break;
    }
    if (!isMissingColumnError(res.error)) {
      tasksError = res.error;
      break;
    }
    tasksError = res.error;
  }

  if (tasksError) {
    if (!isMissingColumnError(tasksError) && !isMissingTableError(tasksError)) {
      console.error("getTasks:", tasksError.message);
    }
    return [];
  }

  if (!tasks?.length) return [];

  const ids = [...new Set(tasks.map((t) => t.student_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  if (profilesError) {
    console.error("getTasks profiles:", profilesError.message);
  }

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name] as const)
  );

  const topicIds = [
    ...new Set(tasks.map((t) => t.topic_id).filter((x): x is string => Boolean(x))),
  ];

  const topicMeta = new Map<
    string,
    { topic_name: string; subject_name: string | null }
  >();

  if (topicIds.length > 0) {
    const { data: topicRows, error: topicErr } = await supabase
      .from("topics")
      .select("id, name, subjects(name)")
      .in("id", topicIds);

    if (topicErr) {
      if (!isMissingTableError(topicErr)) {
        console.error("getTasks topics:", topicErr.message);
      }
    } else {
      for (const row of topicRows ?? []) {
        const subj = row.subjects as { name: string } | { name: string }[] | null;
        const subjectName = Array.isArray(subj)
          ? subj[0]?.name ?? null
          : subj?.name ?? null;
        topicMeta.set(row.id, {
          topic_name: row.name,
          subject_name: subjectName,
        });
      }
    }
  }

  const subjectIds = [
    ...new Set(
      tasks
        .map((t) => t.subject_id)
        .filter((x): x is string => Boolean(x))
    ),
  ];

  const subjectNameById = new Map<string, string>();
  if (subjectIds.length > 0) {
    const { data: subjRows, error: subjErr } = await supabase
      .from("subjects")
      .select("id, name")
      .in("id", subjectIds);

    if (subjErr) {
      if (!isMissingTableError(subjErr)) {
        console.error("getTasks subjects:", subjErr.message);
      }
    } else {
      for (const s of subjRows ?? []) {
        subjectNameById.set(s.id, s.name);
      }
    }
  }

  return tasks.map((t) => {
    const row = t;
    const meta = row.topic_id ? topicMeta.get(row.topic_id) : undefined;
    const kind = row.task_kind as TaskWithStudent["task_kind"];
    const sid = row.subject_id ?? null;
    const subjectFromDirect = sid ? subjectNameById.get(sid) : undefined;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status as "pending" | "completed",
      created_at: row.created_at,
      student_id: row.student_id,
      student_name: nameById.get(row.student_id) ?? "—",
      topic_id: row.topic_id ?? null,
      subject_id: sid,
      task_kind: kind ?? null,
      question_count: row.question_count ?? null,
      followup_question_count: row.followup_question_count ?? null,
      deneme_branch: row.deneme_branch ?? null,
      deneme_target_minutes: row.deneme_target_minutes ?? null,
      deneme_correct: row.deneme_correct ?? null,
      deneme_wrong: row.deneme_wrong ?? null,
      deneme_actual_minutes: row.deneme_actual_minutes ?? null,
      subject_name: meta?.subject_name ?? subjectFromDirect ?? null,
      topic_name: meta?.topic_name ?? null,
    };
  });
}

export type CreateTaskResult = { error?: string };

export async function createTask(formData: FormData): Promise<CreateTaskResult> {
  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { data: me, error: meError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (meError || me?.role !== "teacher") {
    return { error: "Bu işlem için öğretmen yetkisi gerekir." };
  }

  const studentId = formData.get("student_id")?.toString().trim() ?? "";
  const topicId = formData.get("topic_id")?.toString().trim() ?? "";
  const subjectIdRaw = formData.get("subject_id")?.toString().trim() ?? "";
  const taskKindRaw = formData.get("task_kind")?.toString().trim() ?? "";
  const descriptionRaw = formData.get("description")?.toString() ?? "";
  const description = descriptionRaw.trim() || null;

  const task_kind: "soru_cozumu" | "konu_anlatimi" | "deneme_sinavi" =
    taskKindRaw === "konu_anlatimi"
      ? "konu_anlatimi"
      : taskKindRaw === "deneme_sinavi"
        ? "deneme_sinavi"
        : "soru_cozumu";

  if (!studentId) {
    return { error: "Öğrenci seçimi zorunludur." };
  }

  if (task_kind !== "deneme_sinavi" && !topicId) {
    return { error: "Konu seçimi zorunludur." };
  }

  if (task_kind === "deneme_sinavi" && !subjectIdRaw) {
    return { error: "Deneme sınavı için ders seçimi zorunludur." };
  }

  const { data: student, error: studentError } = await supabase
    .from("profiles")
    .select("id, role, teacher_id, full_name")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return { error: "Öğrenci bulunamadı." };
  }

  if (student.role !== "student" || student.teacher_id !== user.id) {
    return { error: "Bu öğrenciye görev atayamazsınız." };
  }

  let subjectName = "Ders";
  let subjectSlug: string | null = null;
  let topicNameForEmail = "";
  let topicIdForInsert: string | null = null;
  let subjectIdForInsert: string | null = null;

  if (task_kind === "deneme_sinavi") {
    const { data: subjRow, error: subjErr } = await supabase
      .from("subjects")
      .select("id, name, slug")
      .eq("id", subjectIdRaw)
      .maybeSingle();

    if (subjErr || !subjRow) {
      return { error: "Ders bulunamadı veya müfredat henüz yüklenmemiş." };
    }

    subjectName = subjRow.name?.trim() ? subjRow.name : "Ders";
    subjectSlug =
      typeof subjRow.slug === "string" && subjRow.slug.trim()
        ? subjRow.slug.trim()
        : null;
    subjectIdForInsert = subjRow.id;
    topicIdForInsert = null;
    topicNameForEmail = "—";
  } else {
    const { data: topicRow, error: topicErr } = await supabase
      .from("topics")
      .select("id, name, subjects(name, slug)")
      .eq("id", topicId)
      .maybeSingle();

    if (topicErr || !topicRow) {
      return { error: "Konu bulunamadı veya müfredat henüz yüklenmemiş." };
    }

    const subj = topicRow.subjects as
      | { name: string; slug?: string | null }
      | { name: string; slug?: string | null }[]
      | null;
    const subjOne = Array.isArray(subj) ? subj[0] : subj;
    subjectName = subjOne?.name?.trim() ? subjOne.name : "Ders";
    subjectSlug =
      typeof subjOne?.slug === "string" && subjOne.slug.trim()
        ? subjOne.slug.trim()
        : null;
    topicIdForInsert = topicRow.id;
    topicNameForEmail = topicRow.name;
    subjectIdForInsert = null;
  }

  let questionCount: number | null = null;
  let followup = 20;
  let denemeBranch: string | null = null;
  let denemeTargetMinutes: number | null = null;

  if (task_kind === "soru_cozumu") {
    const n = Number(formData.get("question_count"));
    if (!Number.isFinite(n) || n < 1 || n > 10000) {
      return { error: "Soru çözümü için geçerli bir soru sayısı girin (1–10000)." };
    }
    questionCount = Math.floor(n);
  } else if (task_kind === "konu_anlatimi") {
    const f = Number(formData.get("followup_question_count"));
    if (Number.isFinite(f) && f >= 0 && f <= 10000) {
      followup = Math.floor(f);
    }
  } else {
    const { branch, targetMinutes } =
      denemeBranchAndTargetFromSubjectSlug(subjectSlug);
    denemeBranch = branch;
    denemeTargetMinutes = targetMinutes;
  }

  const kindLabel =
    task_kind === "konu_anlatimi"
      ? "Konu anlatımı"
      : task_kind === "deneme_sinavi"
        ? "Deneme sınavı"
        : "Soru çözümü";
  const title =
    task_kind === "deneme_sinavi"
      ? `${subjectName} · ${kindLabel}`
      : `${subjectName} · ${topicNameForEmail} · ${kindLabel}`;

  const insertPayload: Record<string, unknown> = {
    student_id: studentId,
    teacher_id: user.id,
    title,
    description,
    status: "pending",
    topic_id: topicIdForInsert,
    task_kind,
    question_count: task_kind === "soru_cozumu" ? questionCount : null,
    followup_question_count:
      task_kind === "konu_anlatimi" ? followup : null,
  };

  if (task_kind === "deneme_sinavi") {
    insertPayload.deneme_branch = denemeBranch;
    insertPayload.deneme_target_minutes = denemeTargetMinutes;
    insertPayload.subject_id = subjectIdForInsert;
  } else {
    insertPayload.subject_id = null;
  }

  const { error: insertError } = await supabase.from("tasks").insert(insertPayload);

  if (insertError) {
    return { error: insertError.message };
  }

  const studentName =
    student.full_name?.trim() || "Öğrenci";

  const { data: teacherProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const teacherName =
    teacherProfile?.full_name?.trim() || "Öğretmeniniz";

  void (async () => {
    try {
      const studentEmail = await resolveTaskNotificationEmail(studentId);
      if (!studentEmail) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[createTask] Öğrenci e-postası bulunamadı. STUDENT_NOTIFY_EMAILS ile eşleyin veya .env içinde SUPABASE_SERVICE_ROLE_KEY tanımlı olsun (kayıt e-postası kullanılır)."
          );
        }
        return;
      }

      await sendTaskAssignedEmail({
        to: studentEmail,
        studentName,
        teacherName,
        subjectName,
        topicName: topicNameForEmail,
        taskKind: task_kind,
        questionCount,
        followupQuestionCount:
          task_kind === "konu_anlatimi" ? followup : null,
        denemeTargetMinutes:
          task_kind === "deneme_sinavi" ? denemeTargetMinutes : null,
        description,
      });
    } catch (e) {
      console.error("[createTask] Öğrenci bildirim e-postası gönderilemedi:", e);
    }
  })();

  revalidatePath("/teacher");
  revalidatePath("/teacher/tasks");
  revalidatePath("/teacher/ilerleme");
  revalidatePath("/student");
  revalidatePath("/student/ilerleme");
  return {};
}

export type TaskMutationResult = { error?: string };

export async function updateTeacherTask(
  formData: FormData
): Promise<TaskMutationResult> {
  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "teacher") {
    return { error: "Bu işlem için öğretmen yetkisi gerekir." };
  }

  const id = (formData.get("task_id") as string)?.trim() ?? "";
  const title = (formData.get("title") as string)?.trim() ?? "";
  const descriptionRaw = (formData.get("description") as string) ?? "";
  const description = descriptionRaw.trim() || null;
  const statusRaw = (formData.get("status") as string)?.trim() ?? "";

  if (!id || !title) return { error: "Başlık zorunludur." };
  if (statusRaw !== "pending" && statusRaw !== "completed") {
    return { error: "Geçersiz durum." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      description,
      status: statusRaw,
    })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/teacher");
  revalidatePath("/teacher/tasks");
  revalidatePath("/teacher/ilerleme");
  revalidatePath("/student");
  revalidatePath("/student/ilerleme");
  return {};
}

export type TeacherStudentQuestionSubmissionRow = {
  id: string;
  student_id: string;
  student_name: string;
  topic_id: string;
  topic_name: string;
  subject_name: string | null;
  file_name: string;
  content_type: string | null;
  size_bytes: number;
  created_at: string;
  answer_status: "pending" | "answered";
  answered_at: string | null;
  answer_file_name: string | null;
  issue_kind: QuestionIssueKind;
};

export async function getTeacherStudentQuestionSubmissions(): Promise<
  TeacherStudentQuestionSubmissionRow[]
> {
  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "teacher") return [];

  const { data, error } = await supabase
    .from("student_question_submissions")
    .select(
      "id, student_id, topic_id, file_name, content_type, size_bytes, created_at, answer_status, answered_at, answer_file_name, issue_kind, profiles!student_question_submissions_student_id_fkey(full_name), topics(name, subjects(name))"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("getTeacherStudentQuestionSubmissions:", error.message);
    }
    return [];
  }

  type RawRow = {
    id: string;
    student_id: string;
    topic_id: string;
    file_name: string;
    content_type: string | null;
    size_bytes: number;
    created_at: string;
    answer_status?: string | null;
    answered_at?: string | null;
    answer_file_name?: string | null;
    issue_kind?: string | null;
    profiles:
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    topics:
      | {
          name: string;
          subjects:
            | { name: string }
            | { name: string }[]
            | null;
        }
      | {
          name: string;
          subjects:
            | { name: string }
            | { name: string }[]
            | null;
        }[]
      | null;
  };

  return (data as RawRow[] | null)?.map((row) => {
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const top = Array.isArray(row.topics) ? row.topics[0] : row.topics;
    const subj = top?.subjects;
    const subjectName = Array.isArray(subj) ? subj[0]?.name : subj?.name;
    const ast =
      row.answer_status === "answered" ? "answered" : "pending";
    return {
      id: row.id,
      student_id: row.student_id,
      student_name: prof?.full_name?.trim() || "Öğrenci",
      topic_id: row.topic_id,
      topic_name: top?.name ?? "Konu",
      subject_name: subjectName ?? null,
      file_name: row.file_name,
      content_type: row.content_type,
      size_bytes: row.size_bytes,
      created_at: row.created_at,
      answer_status: ast,
      answered_at: row.answered_at ?? null,
      answer_file_name: row.answer_file_name ?? null,
      issue_kind: parseQuestionIssueKind(row.issue_kind),
    };
  }) ?? [];
}

/** Öğretmen: hangi öğrencide hangi konu eksik (gönderimlere göre; skor arayüzde yok). */
export type TeacherTopicWeaknessRollupRow = {
  student_id: string;
  student_name: string;
  topic_id: string;
  topic_name: string;
  subject_name: string | null;
  last_at: string;
};

export async function getTeacherTopicWeaknessRollup(
  filterStudentId?: string | null
): Promise<TeacherTopicWeaknessRollupRow[]> {
  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "teacher") return [];

  const { data: disData, error: disErr } = await supabase
    .from("teacher_topic_weakness_dismissals")
    .select("student_id, topic_id, dismissed_at")
    .eq("teacher_id", user.id);

  if (disErr && disErr.code !== "42P01" && disErr.code !== "PGRST205") {
    console.error("getTeacherTopicWeaknessRollup dismissals:", disErr.message);
  }

  const dismissAtByPair = new Map<string, string>();
  if (!disErr && disData) {
    for (const d of disData as {
      student_id: string;
      topic_id: string;
      dismissed_at: string;
    }[]) {
      dismissAtByPair.set(`${d.student_id}\0${d.topic_id}`, d.dismissed_at);
    }
  }

  let q = supabase
    .from("student_question_submissions")
    .select(
      "student_id, topic_id, issue_kind, created_at, profiles!student_question_submissions_student_id_fkey(full_name), topics(name, subjects(name))"
    )
    .order("created_at", { ascending: false })
    .limit(4000);

  const fid = filterStudentId?.trim();
  if (fid) {
    const { data: stu } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", fid)
      .eq("role", "student")
      .eq("teacher_id", user.id)
      .maybeSingle();
    if (!stu) return [];
    q = q.eq("student_id", fid);
  }

  const { data, error } = await q;

  if (error) {
    if (
      error.code === "42703" ||
      error.message?.toLowerCase().includes("issue_kind")
    ) {
      return [];
    }
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("getTeacherTopicWeaknessRollup:", error.message);
    }
    return [];
  }

  type RawAgg = {
    student_id: string;
    topic_id: string;
    issue_kind?: string | null;
    created_at: string;
    profiles:
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    topics:
      | {
          name: string;
          subjects:
            | { name: string }
            | { name: string }[]
            | null;
        }
      | {
          name: string;
          subjects:
            | { name: string }
            | { name: string }[]
            | null;
        }[]
      | null;
  };

  const pairKey = (sid: string, tid: string) => `${sid}\0${tid}`;
  const byPair = new Map<
    string,
    {
      student_id: string;
      student_name: string;
      topic_id: string;
      topic_name: string;
      subject_name: string | null;
      last_at: string;
    }
  >();

  function ingestWeaknessRow(row: RawAgg) {
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const sid = row.student_id;
    const tid = row.topic_id;
    const k = pairKey(sid, tid);
    const cutoff = dismissAtByPair.get(k);
    if (cutoff) {
      const tSub = new Date(row.created_at).getTime();
      const tCut = new Date(cutoff).getTime();
      if (tSub <= tCut) return;
    }

    const top = Array.isArray(row.topics) ? row.topics[0] : row.topics;
    const subj = top?.subjects;
    const subjectName = Array.isArray(subj) ? subj[0]?.name : subj?.name;
    const topicName = top?.name ?? "Konu";

    let agg = byPair.get(k);
    if (!agg) {
      agg = {
        student_id: sid,
        student_name: prof?.full_name?.trim() || "Öğrenci",
        topic_id: tid,
        topic_name: topicName,
        subject_name: subjectName ?? null,
        last_at: row.created_at,
      };
      byPair.set(k, agg);
    } else if (new Date(row.created_at) > new Date(agg.last_at)) {
      agg.last_at = row.created_at;
    }
  }

  for (const row of (data ?? []) as RawAgg[]) {
    ingestWeaknessRow(row);
  }

  let qDen = supabase
    .from("student_deneme_wrong_topics")
    .select(
      "student_id, topic_id, created_at, profiles(full_name), topics(name, subjects(name))"
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (fid) {
    qDen = qDen.eq("student_id", fid);
  }

  const { data: denData, error: denErr } = await qDen;

  if (denErr) {
    const msg = (denErr.message ?? "").toLowerCase();
    if (
      denErr.code !== "42P01" &&
      denErr.code !== "PGRST205" &&
      !msg.includes("student_deneme_wrong_topics") &&
      !msg.includes("does not exist")
    ) {
      console.error("getTeacherTopicWeaknessRollup deneme wrong topics:", denErr.message);
    }
  } else {
    for (const row of (denData ?? []) as RawAgg[]) {
      ingestWeaknessRow(row);
    }
  }

  const list: TeacherTopicWeaknessRollupRow[] = [...byPair.values()].map((a) => ({
    student_id: a.student_id,
    student_name: a.student_name,
    topic_id: a.topic_id,
    topic_name: a.topic_name,
    subject_name: a.subject_name,
    last_at: a.last_at,
  }));

  list.sort(
    (x, y) => new Date(y.last_at).getTime() - new Date(x.last_at).getTime()
  );

  return list;
}

/** Öğretmen: (öğrenci, konu) satırını listeden kaldırır; sonrasındaki yeni gönderimler tekrar gösterir. */
export async function dismissTeacherTopicWeakness(
  studentId: string,
  topicId: string
): Promise<{ error?: string }> {
  const sid = studentId?.trim();
  const tid = topicId?.trim();
  if (!sid || !tid) return { error: "Geçersiz kayıt." };

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "teacher") {
    return { error: "Bu işlem öğretmen içindir." };
  }

  const { data: stu } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", sid)
    .eq("role", "student")
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!stu) {
    return { error: "Öğrenci bulunamadı veya size atanmamış." };
  }

  const { data: topicRow } = await supabase
    .from("topics")
    .select("id")
    .eq("id", tid)
    .maybeSingle();
  if (!topicRow) return { error: "Konu bulunamadı." };

  const { error } = await supabase.from("teacher_topic_weakness_dismissals").upsert(
    {
      teacher_id: user.id,
      student_id: sid,
      topic_id: tid,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: "student_id,topic_id,teacher_id" }
  );

  if (error) {
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.message?.toLowerCase().includes("teacher_topic_weakness")
    ) {
      return {
        error:
          "Tablo yok. Supabase'de teacher-topic-weakness-dismissals.sql dosyasını çalıştırın.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/teacher/konu-eksikleri");
  return {};
}

export async function getStudentQuestionSubmissionDownloadUrlForTeacher(
  submissionId: string
): Promise<{ error?: string; url?: string }> {
  const id = submissionId?.trim();
  if (!id) return { error: "Geçersiz kayıt." };

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "teacher") {
    return { error: "Bu işlem öğretmen içindir." };
  }

  const { data: row, error } = await supabase
    .from("student_question_submissions")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { error: "Soru gönderileri henüz etkin değil." };
    }
    return { error: error.message };
  }
  if (!row) return { error: "Dosya bulunamadı." };

  const { data: signed, error: signErr } = await supabase.storage
    .from(STUDENT_QUESTION_BUCKET)
    .createSignedUrl(
      row.storage_path as string,
      STUDENT_QUESTION_SIGNED_URL_SEC
    );

  if (signErr || !signed?.signedUrl) {
    return { error: signErr?.message ?? "Bağlantı oluşturulamadı." };
  }
  return { url: signed.signedUrl };
}

export async function getStudentQuestionSubmissionAnswerDownloadUrlForTeacher(
  submissionId: string
): Promise<{ error?: string; url?: string }> {
  const id = submissionId?.trim();
  if (!id) return { error: "Geçersiz kayıt." };

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "teacher") {
    return { error: "Bu işlem öğretmen içindir." };
  }

  const { data: row, error } = await supabase
    .from("student_question_submissions")
    .select("answer_storage_path, answer_status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { error: "Kayıtlar henüz etkin değil." };
    }
    return { error: error.message };
  }
  if (!row || row.answer_status !== "answered" || !row.answer_storage_path) {
    return { error: "Bu soru için cevap görseli yok." };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(QUESTION_ANSWER_BUCKET)
    .createSignedUrl(
      row.answer_storage_path as string,
      QUESTION_ANSWER_SIGNED_URL_SEC
    );

  if (signErr || !signed?.signedUrl) {
    return { error: signErr?.message ?? "Bağlantı oluşturulamadı." };
  }
  return { url: signed.signedUrl };
}

function sanitizeTeacherAnswerFileBase(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return base.trim() || "cevap";
}

export type TeacherUploadAnswerResult = { error?: string };

/** Öğretmen: kendi öğrencisinin sorusuna cevap görseli yükler (JPEG/PNG/WebP). */
export async function teacherUploadSubmissionAnswer(
  submissionId: string,
  formData: FormData
): Promise<TeacherUploadAnswerResult> {
  const sid = submissionId?.trim();
  if (!sid) return { error: "Geçersiz kayıt." };

  const raw = formData.get("file");
  if (!raw || typeof raw === "string") return { error: "Dosya seçin." };
  const file = raw as File;
  if (!file.size) return { error: "Dosya boş." };
  if (file.size > MAX_QUESTION_ANSWER_BYTES) {
    return { error: "Cevap görseli en fazla 10 MB olabilir." };
  }
  const mime = (file.type || "").toLowerCase();
  if (!QUESTION_ANSWER_ALLOWED_TYPES.has(mime)) {
    return { error: "Yalnızca JPEG, PNG veya WebP yükleyin." };
  }

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "teacher") {
    return { error: "Bu işlem öğretmen içindir." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("student_question_submissions")
    .select("id, student_id, answer_storage_path")
    .eq("id", sid)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Kayıt bulunamadı veya bu öğrenciye erişim yok." };

  const studentId = row.student_id as string;
  const oldPath = row.answer_storage_path as string | null;

  const safeBase = sanitizeTeacherAnswerFileBase(file.name);
  const objectName = `${randomUUID()}_${safeBase}`;
  const storagePath = `${studentId}/${sid}/${objectName}`;

  const { error: upErr } = await supabase.storage
    .from(QUESTION_ANSWER_BUCKET)
    .upload(storagePath, file, {
      contentType: mime,
      upsert: false,
    });

  if (upErr) {
    if (
      upErr.message?.includes("Bucket not found") ||
      upErr.message?.includes("not found")
    ) {
      return {
        error:
          "Cevap deposu yok veya öğretmen yükleme izni eksik. Supabase'de student-question-answers.sql güncel halini çalıştırın.",
      };
    }
    if (
      upErr.message?.includes("new row violates row-level security") ||
      upErr.message?.includes("RLS")
    ) {
      return {
        error:
          "Yükleme reddedildi. Veritabanında öğretmen INSERT politikası yok; student-question-answers.sql dosyasının son halini çalıştırın.",
      };
    }
    return { error: upErr.message };
  }

  if (oldPath) {
    await supabase.storage.from(QUESTION_ANSWER_BUCKET).remove([oldPath]);
  }

  const { error: updErr } = await supabase
    .from("student_question_submissions")
    .update({
      answer_status: "answered",
      answer_storage_path: storagePath,
      answer_file_name: file.name.slice(0, 200) || safeBase,
      answer_content_type: mime,
      answer_size_bytes: file.size,
      answered_at: new Date().toISOString(),
      answered_by: user.id,
    })
    .eq("id", sid);

  if (updErr) {
    await supabase.storage.from(QUESTION_ANSWER_BUCKET).remove([storagePath]);
    if (updErr.code === "42501" || updErr.message?.includes("policy")) {
      return {
        error:
          "Güncelleme reddedildi. student-question-answers.sql içindeki öğretmen UPDATE politikasını uygulayın.",
      };
    }
    if (updErr.code === "42703" || updErr.message?.includes("answer_status")) {
      return {
        error:
          "Veritabanı güncel değil. student-question-answers.sql dosyasını çalıştırın.",
      };
    }
    return { error: updErr.message };
  }

  revalidatePath("/teacher/sorular");
  revalidatePath("/teacher/konu-eksikleri");
  revalidatePath("/student/sorularim");
  revalidatePath("/admin/ogrenci-sorulari");
  return {};
}

/** Öğretmen: yüklediği cevap görselini siler; kayıt tekrar cevap bekliyor olur. */
export async function teacherDeleteSubmissionAnswer(
  submissionId: string
): Promise<TeacherUploadAnswerResult> {
  const sid = submissionId?.trim();
  if (!sid) return { error: "Geçersiz kayıt." };

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "teacher") {
    return { error: "Bu işlem öğretmen içindir." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("student_question_submissions")
    .select("answer_storage_path, answer_status")
    .eq("id", sid)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Kayıt bulunamadı veya bu öğrenciye erişim yok." };
  if (row.answer_status !== "answered") {
    return { error: "Bu kayıtta silinecek cevap yok." };
  }

  const path = row.answer_storage_path as string | null;
  if (path) {
    await supabase.storage.from(QUESTION_ANSWER_BUCKET).remove([path]);
  }

  const { error: updErr } = await supabase
    .from("student_question_submissions")
    .update({
      answer_status: "pending",
      answer_storage_path: null,
      answer_file_name: null,
      answer_content_type: null,
      answer_size_bytes: null,
      answered_at: null,
      answered_by: null,
    })
    .eq("id", sid);

  if (updErr) {
    return { error: updErr.message };
  }

  revalidatePath("/teacher/sorular");
  revalidatePath("/teacher/konu-eksikleri");
  revalidatePath("/student/sorularim");
  revalidatePath("/admin/ogrenci-sorulari");
  return {};
}

export async function deleteTeacherTask(taskId: string): Promise<TaskMutationResult> {
  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "teacher") {
    return { error: "Bu işlem için öğretmen yetkisi gerekir." };
  }

  const id = taskId?.trim();
  if (!id) return { error: "Geçersiz görev." };

  const { data: taskRow, error: fetchErr } = await supabase
    .from("tasks")
    .select(
      "id, student_id, topic_id, status, task_kind, question_count, followup_question_count"
    )
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!taskRow) return { error: "Görev bulunamadı." };

  await revertStudentProgressForDeletedTask(supabase, {
    id: taskRow.id,
    student_id: taskRow.student_id as string,
    topic_id: (taskRow.topic_id as string | null) ?? null,
    status: taskRow.status as string,
    task_kind: (taskRow.task_kind as string | null) ?? null,
    question_count: taskRow.question_count as number | null,
    followup_question_count: taskRow.followup_question_count as number | null,
  });

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/teacher");
  revalidatePath("/teacher/tasks");
  revalidatePath("/teacher/ilerleme");
  revalidatePath("/student");
  revalidatePath("/student/ilerleme");
  revalidatePath("/student/ders-programi");
  return {};
}

/** Öğretmen: öğrencinin konu tamamlama kaydını kaldırır (yanlış tamamlama düzeltmesi). */
export async function deleteTeacherStudentTopicCompletion(
  studentId: string,
  topicId: string
): Promise<TaskMutationResult> {
  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "teacher") {
    return { error: "Bu işlem için öğretmen yetkisi gerekir." };
  }

  const sid = studentId?.trim();
  const tid = topicId?.trim();
  if (!sid || !tid) return { error: "Geçersiz parametre." };

  const { data: stu } = await supabase
    .from("profiles")
    .select("id, teacher_id")
    .eq("id", sid)
    .eq("role", "student")
    .maybeSingle();

  if (!stu || stu.teacher_id !== user.id) {
    return { error: "Bu öğrenciye erişim yok." };
  }

  const { data: comp } = await supabase
    .from("student_topic_completions")
    .select("task_id")
    .eq("student_id", sid)
    .eq("topic_id", tid)
    .maybeSingle();

  if (!comp) return { error: "Bu konu için tamamlama kaydı yok." };

  let followup = DEFAULT_FOLLOWUP_QUESTIONS;
  if (comp.task_id) {
    const { data: task } = await supabase
      .from("tasks")
      .select("followup_question_count, task_kind")
      .eq("id", comp.task_id)
      .eq("student_id", sid)
      .maybeSingle();
    if (task?.task_kind === "konu_anlatimi") {
      const f = task.followup_question_count;
      followup =
        typeof f === "number" && Number.isFinite(f) && f >= 0
          ? Math.floor(f)
          : DEFAULT_FOLLOWUP_QUESTIONS;
    }
  }

  const { data: deletedRows, error: delErr } = await supabase
    .from("student_topic_completions")
    .delete()
    .eq("student_id", sid)
    .eq("topic_id", tid)
    .select("student_id");

  if (delErr) return { error: delErr.message };
  if (!deletedRows?.length) {
    return {
      error:
        "Kayıt silinemedi. Supabase'de teacher-task-delete-progress-rls.sql dosyasını çalıştırdığınızdan emin olun.",
    };
  }

  await decrementTopicQuestionsSolved(supabase, sid, tid, followup);

  revalidatePath("/teacher");
  revalidatePath("/teacher/ilerleme");
  revalidatePath("/student");
  revalidatePath("/student/ilerleme");
  revalidatePath("/admin/istatistikler");
  return {};
}

/** Öğretmen: konu bazlı çözülen soru sayısını ayarlar (0 = kayıt yok). */
export async function setTeacherStudentTopicQuestionsSolved(
  studentId: string,
  topicId: string,
  questionsSolvedRaw: number
): Promise<TaskMutationResult> {
  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "teacher") {
    return { error: "Bu işlem için öğretmen yetkisi gerekir." };
  }

  const sid = studentId?.trim();
  const tid = topicId?.trim();
  if (!sid || !tid) return { error: "Geçersiz parametre." };

  const raw = Number(questionsSolvedRaw);
  if (!Number.isFinite(raw)) return { error: "Geçersiz sayı." };
  const n = Math.floor(raw);
  if (n < 0) return { error: "Sayı negatif olamaz." };
  if (n > 1_000_000) return { error: "Sayı çok büyük." };

  const { data: stu } = await supabase
    .from("profiles")
    .select("id, teacher_id")
    .eq("id", sid)
    .eq("role", "student")
    .maybeSingle();

  if (!stu || stu.teacher_id !== user.id) {
    return { error: "Bu öğrenciye erişim yok." };
  }

  if (n === 0) {
    const { error: delErr } = await supabase
      .from("student_topic_question_stats")
      .delete()
      .eq("student_id", sid)
      .eq("topic_id", tid);
    if (delErr) return { error: delErr.message };
  } else {
    const { data: existing } = await supabase
      .from("student_topic_question_stats")
      .select("questions_solved")
      .eq("student_id", sid)
      .eq("topic_id", tid)
      .maybeSingle();

    if (existing) {
      const { error: upErr } = await supabase
        .from("student_topic_question_stats")
        .update({ questions_solved: n })
        .eq("student_id", sid)
        .eq("topic_id", tid);
      if (upErr) return { error: upErr.message };
    } else {
      const { error: insErr } = await supabase
        .from("student_topic_question_stats")
        .insert({
          student_id: sid,
          topic_id: tid,
          questions_solved: n,
        });
      if (insErr) return { error: insErr.message };
    }
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/ilerleme");
  revalidatePath("/student");
  revalidatePath("/student/ilerleme");
  revalidatePath("/admin/istatistikler");
  return {};
}

export type TeacherNotificationRow = {
  id: string;
  task_id: string | null;
  submission_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

export async function getTeacherNotifications(): Promise<
  TeacherNotificationRow[]
> {
  const { user, supabase } = await getCachedAuth();

  if (!user) return [];

  const full = await supabase
    .from("teacher_notifications")
    .select("id, task_id, submission_id, message, read_at, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (full.error) {
    const msg = (full.error.message ?? "").toLowerCase();
    if (
      msg.includes("submission_id") ||
      msg.includes("schema cache") ||
      full.error.code === "PGRST204"
    ) {
      const legacy = await supabase
        .from("teacher_notifications")
        .select("id, task_id, message, read_at, created_at")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!legacy.error) {
        return (legacy.data ?? []).map((row) => ({
          ...(row as Omit<TeacherNotificationRow, "submission_id">),
          submission_id: null,
        }));
      }
    }
    if (full.error.code !== "42P01") {
      console.error("getTeacherNotifications:", full.error.message);
    }
    return [];
  }

  return (full.data ?? []) as TeacherNotificationRow[];
}

export type MarkReadResult = { error?: string };

export async function markNotificationRead(
  notificationId: string
): Promise<MarkReadResult> {
  const id = notificationId?.trim();
  if (!id) return { error: "Geçersiz bildirim." };

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Oturum bulunamadı." };

  const { error } = await supabase
    .from("teacher_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    if (error.code === "42P01") {
      return { error: "Bildirim tablosu henüz oluşturulmamış." };
    }
    return { error: error.message };
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/tasks");
  revalidatePath("/teacher/sorular");
  return {};
}
