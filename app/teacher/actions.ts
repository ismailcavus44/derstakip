"use server";

import { revalidatePath } from "next/cache";
import { getCachedAuth } from "@/lib/auth/cached-auth";
import { sendTaskAssignedEmail } from "@/lib/email/send-task-assigned-email";
import { getNotificationEmailForStudent } from "@/lib/email/student-notify-email";
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
  task_kind: "soru_cozumu" | "konu_anlatimi" | null;
  question_count: number | null;
  followup_question_count: number | null;
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

  const fullSelect =
    "id, title, description, status, created_at, student_id, topic_id, task_kind, question_count, followup_question_count";
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
    task_kind?: string | null;
    question_count?: number | null;
    followup_question_count?: number | null;
  };

  const first = await supabase
    .from("tasks")
    .select(fullSelect)
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  let tasks: TaskRowDb[] | null = first.data as TaskRowDb[] | null;
  let tasksError = first.error;

  if (tasksError && isMissingColumnError(tasksError)) {
    const retry = await supabase
      .from("tasks")
      .select(legacySelect)
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    tasks = retry.data as TaskRowDb[] | null;
    tasksError = retry.error;
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

  return tasks.map((t) => {
    const row = t;
    const meta = row.topic_id ? topicMeta.get(row.topic_id) : undefined;
    const kind = row.task_kind as TaskWithStudent["task_kind"];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status as "pending" | "completed",
      created_at: row.created_at,
      student_id: row.student_id,
      student_name: nameById.get(row.student_id) ?? "—",
      topic_id: row.topic_id ?? null,
      task_kind: kind ?? null,
      question_count: row.question_count ?? null,
      followup_question_count: row.followup_question_count ?? null,
      subject_name: meta?.subject_name ?? null,
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
  const taskKindRaw = formData.get("task_kind")?.toString().trim() ?? "";
  const descriptionRaw = formData.get("description")?.toString() ?? "";
  const description = descriptionRaw.trim() || null;

  const task_kind =
    taskKindRaw === "konu_anlatimi" ? "konu_anlatimi" : "soru_cozumu";

  if (!studentId || !topicId) {
    return { error: "Öğrenci ve konu seçimi zorunludur." };
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

  const { data: topicRow, error: topicErr } = await supabase
    .from("topics")
    .select("id, name, subjects(name)")
    .eq("id", topicId)
    .maybeSingle();

  if (topicErr || !topicRow) {
    return { error: "Konu bulunamadı veya müfredat henüz yüklenmemiş." };
  }

  const subj = topicRow.subjects as { name: string } | { name: string }[] | null;
  const subjectName = Array.isArray(subj)
    ? subj[0]?.name ?? "Ders"
    : subj?.name ?? "Ders";

  let questionCount: number | null = null;
  let followup = 20;

  if (task_kind === "soru_cozumu") {
    const n = Number(formData.get("question_count"));
    if (!Number.isFinite(n) || n < 1 || n > 10000) {
      return { error: "Soru çözümü için geçerli bir soru sayısı girin (1–10000)." };
    }
    questionCount = Math.floor(n);
  } else {
    const f = Number(formData.get("followup_question_count"));
    if (Number.isFinite(f) && f >= 0 && f <= 10000) {
      followup = Math.floor(f);
    }
  }

  const kindLabel =
    task_kind === "konu_anlatimi" ? "Konu anlatımı" : "Soru çözümü";
  const title = `${subjectName} · ${topicRow.name} · ${kindLabel}`;

  const { error: insertError } = await supabase.from("tasks").insert({
    student_id: studentId,
    teacher_id: user.id,
    title,
    description,
    status: "pending",
    topic_id: topicId,
    task_kind,
    question_count: questionCount,
    followup_question_count: task_kind === "konu_anlatimi" ? followup : null,
  });

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
      const studentEmail = getNotificationEmailForStudent(studentId);
      if (!studentEmail) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[createTask] Bildirim e-postası tanımlı değil. STUDENT_NOTIFY_EMAIL / STUDENT_NOTIFY_EMAILS ile öğrenci UUID eşleyin."
          );
        }
        return;
      }

      await sendTaskAssignedEmail({
        to: studentEmail,
        studentName,
        teacherName,
        subjectName,
        topicName: topicRow.name,
        taskKind: task_kind,
        questionCount,
        followupQuestionCount:
          task_kind === "konu_anlatimi" ? followup : null,
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
  task_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export async function getTeacherNotifications(): Promise<
  TeacherNotificationRow[]
> {
  const { user, supabase } = await getCachedAuth();

  if (!user) return [];

  const { data, error } = await supabase
    .from("teacher_notifications")
    .select("id, task_id, message, read_at, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    if (error.code !== "42P01") {
      console.error("getTeacherNotifications:", error.message);
    }
    return [];
  }

  return (data ?? []) as TeacherNotificationRow[];
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
  return {};
}
