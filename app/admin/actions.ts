"use server";

import { revalidatePath } from "next/cache";

import { createClient, createServerActionClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/admin";

export type AdminTeacherRow = { id: string; full_name: string };

export type AdminStudentRow = {
  id: string;
  full_name: string;
  teacher_id: string | null;
  email: string;
  teacher_name: string | null;
};

async function requireAdminProfile() {
  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." as const, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: "Bu işlem için yönetici yetkisi gerekir." as const, user: null };
  }

  return { error: null, user };
}

export type ActionResult = { error?: string };

export async function getAdminDashboardData(): Promise<{
  teachers: AdminTeacherRow[];
  students: AdminStudentRow[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return null;

  let admin;
  try {
    admin = createServerAdminClient();
  } catch {
    return null;
  }

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, role, full_name, teacher_id")
    .in("role", ["teacher", "student"])
    .order("full_name", { ascending: true });

  if (error) {
    console.error("getAdminDashboardData profiles:", error.message);
    return null;
  }

  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listErr) {
    console.error("getAdminDashboardData listUsers:", listErr.message);
  }

  const emailById = new Map(
    (listData?.users ?? []).map((u) => [u.id, u.email ?? ""] as const)
  );

  const teachers = (profiles ?? [])
    .filter((p) => p.role === "teacher")
    .map((p) => ({ id: p.id, full_name: p.full_name ?? "" }));

  const teacherNameById = new Map(
    teachers.map((t) => [t.id, t.full_name || "—"] as const)
  );

  const students: AdminStudentRow[] = (profiles ?? [])
    .filter((p) => p.role === "student")
    .map((p) => ({
      id: p.id,
      full_name: p.full_name ?? "",
      teacher_id: p.teacher_id,
      email: emailById.get(p.id) ?? "—",
      teacher_name: p.teacher_id
        ? teacherNameById.get(p.teacher_id) ?? null
        : null,
    }));

  return { teachers, students };
}

export type AdminCompletionStat = {
  student_id: string;
  topic_id: string;
  student_name: string;
  completed_at: string;
  subject_name: string | null;
  topic_name: string | null;
};

export type AdminQuestionStat = {
  student_id: string;
  topic_id: string;
  student_name: string;
  questions_solved: number;
  subject_name: string | null;
  topic_name: string | null;
};

export async function getAdminStudentStats(
  filterStudentId?: string | null
): Promise<{
  completions: AdminCompletionStat[];
  questionStats: AdminQuestionStat[];
  tablesMissing: boolean;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return null;

  let admin;
  try {
    admin = createServerAdminClient();
  } catch {
    return null;
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "student");

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? "—"] as const)
  );

  const sid = filterStudentId?.trim();
  const filterByStudent =
    sid && nameById.has(sid) ? sid : undefined;

  let cQuery = admin
    .from("student_topic_completions")
    .select("student_id, topic_id, completed_at, topics(name, subjects(name))")
    .order("completed_at", { ascending: false });
  if (filterByStudent) {
    cQuery = cQuery.eq("student_id", filterByStudent);
  }
  const { data: rawC, error: cErr } = await cQuery;

  let qQuery = admin
    .from("student_topic_question_stats")
    .select("student_id, topic_id, questions_solved, topics(name, subjects(name))");
  if (filterByStudent) {
    qQuery = qQuery.eq("student_id", filterByStudent);
  }
  const { data: rawQ, error: qErr } = await qQuery;

  const tablesMissing = Boolean(
    cErr?.code === "42P01" || qErr?.code === "42P01"
  );

  if (cErr && cErr.code !== "42P01") {
    console.error("getAdminStudentStats completions:", cErr.message);
  }
  if (qErr && qErr.code !== "42P01") {
    console.error("getAdminStudentStats qstats:", qErr.message);
  }

  const parseTopic = (
    row: unknown
  ): { name: string | null; subject: string | null } => {
    const top = row as {
      name?: string;
      subjects?: { name: string } | { name: string }[] | null;
    } | null;
    if (!top) return { name: null, subject: null };
    const subj = top.subjects;
    const subjectName = Array.isArray(subj)
      ? subj[0]?.name ?? null
      : subj?.name ?? null;
    return { name: top.name ?? null, subject: subjectName };
  };

  const completions: AdminCompletionStat[] = (rawC ?? []).map((row) => {
    const t = parseTopic(row.topics);
    return {
      student_id: row.student_id,
      topic_id: row.topic_id,
      student_name: nameById.get(row.student_id) ?? "—",
      completed_at: row.completed_at,
      subject_name: t.subject,
      topic_name: t.name,
    };
  });

  const questionStats: AdminQuestionStat[] = (rawQ ?? []).map((row) => {
    const t = parseTopic(row.topics);
    return {
      student_id: row.student_id,
      topic_id: row.topic_id,
      student_name: nameById.get(row.student_id) ?? "—",
      questions_solved: row.questions_solved ?? 0,
      subject_name: t.subject,
      topic_name: t.name,
    };
  });

  return { completions, questionStats, tablesMissing };
}

async function requireAdminServiceClient(): Promise<
  | { error: string; admin: null }
  | { error: null; admin: ReturnType<typeof createServerAdminClient> }
> {
  const gate = await requireAdminProfile();
  if (gate.error || !gate.user) {
    return { error: gate.error ?? "Yetkisiz.", admin: null };
  }
  try {
    return { error: null, admin: createServerAdminClient() };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Sunucu yapılandırması eksik (SUPABASE_SERVICE_ROLE_KEY).",
      admin: null,
    };
  }
}

/** Yönetici: tek öğrenci için konu tamamlama satırını siler (demo / düzeltme). */
export async function adminDeleteStudentTopicCompletion(
  studentId: string,
  topicId: string
): Promise<ActionResult> {
  const ctx = await requireAdminServiceClient();
  if (ctx.error || !ctx.admin) return { error: ctx.error ?? "Yetkisiz." };

  const sid = studentId?.trim();
  const tid = topicId?.trim();
  if (!sid || !tid) return { error: "Geçersiz parametre." };

  const { data: st } = await ctx.admin
    .from("profiles")
    .select("id")
    .eq("id", sid)
    .eq("role", "student")
    .maybeSingle();
  if (!st) return { error: "Öğrenci bulunamadı." };

  const { error } = await ctx.admin
    .from("student_topic_completions")
    .delete()
    .eq("student_id", sid)
    .eq("topic_id", tid);

  if (error) return { error: error.message };

  revalidatePath("/admin/istatistikler");
  revalidatePath("/student/ilerleme");
  revalidatePath("/teacher/ilerleme");
  return {};
}

/** Yönetici: konu bazlı çözülen soru sayısını ayarlar (0 = satır silinir). */
export async function adminSetStudentTopicQuestionsSolved(
  studentId: string,
  topicId: string,
  questionsSolvedRaw: number
): Promise<ActionResult> {
  const ctx = await requireAdminServiceClient();
  if (ctx.error || !ctx.admin) return { error: ctx.error ?? "Yetkisiz." };

  const sid = studentId?.trim();
  const tid = topicId?.trim();
  if (!sid || !tid) return { error: "Geçersiz parametre." };

  const raw = Number(questionsSolvedRaw);
  if (!Number.isFinite(raw)) return { error: "Geçersiz sayı." };
  const n = Math.floor(raw);
  if (n < 0) return { error: "Sayı negatif olamaz." };
  if (n > 1_000_000) return { error: "Sayı çok büyük." };

  const { data: st } = await ctx.admin
    .from("profiles")
    .select("id")
    .eq("id", sid)
    .eq("role", "student")
    .maybeSingle();
  if (!st) return { error: "Öğrenci bulunamadı." };

  if (n === 0) {
    const { error } = await ctx.admin
      .from("student_topic_question_stats")
      .delete()
      .eq("student_id", sid)
      .eq("topic_id", tid);
    if (error) return { error: error.message };
  } else {
    const { data: existing } = await ctx.admin
      .from("student_topic_question_stats")
      .select("questions_solved")
      .eq("student_id", sid)
      .eq("topic_id", tid)
      .maybeSingle();

    if (existing) {
      const { error } = await ctx.admin
        .from("student_topic_question_stats")
        .update({ questions_solved: n })
        .eq("student_id", sid)
        .eq("topic_id", tid);
      if (error) return { error: error.message };
    } else {
      const { error } = await ctx.admin
        .from("student_topic_question_stats")
        .insert({
          student_id: sid,
          topic_id: tid,
          questions_solved: n,
        });
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/admin/istatistikler");
  revalidatePath("/student/ilerleme");
  revalidatePath("/teacher/ilerleme");
  return {};
}

export async function createStudentUser(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const gate = await requireAdminProfile();
  if (gate.error || !gate.user) return { error: gate.error ?? "Yetkisiz." };

  const email = (formData.get("email") as string)?.trim() ?? "";
  const password = (formData.get("password") as string) ?? "";
  const fullName = (formData.get("full_name") as string)?.trim() ?? "";
  const teacherIdRaw = (formData.get("teacher_id") as string)?.trim() ?? "";
  const teacherOrNone =
    !teacherIdRaw || teacherIdRaw === "__none__" ? "" : teacherIdRaw;

  if (!email || !password || !fullName) {
    return { error: "E-posta, şifre ve ad soyad zorunludur." };
  }
  if (password.length < 6) {
    return { error: "Şifre en az 6 karakter olmalıdır." };
  }

  let admin;
  try {
    admin = createServerAdminClient();
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Sunucu yapılandırması eksik (SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  let teacherMeta: string | undefined;
  if (teacherOrNone) {
    const { data: t } = await admin
      .from("profiles")
      .select("id")
      .eq("id", teacherOrNone)
      .eq("role", "teacher")
      .maybeSingle();
    if (!t) return { error: "Seçilen öğretmen geçersiz." };
    teacherMeta = teacherOrNone;
  }

  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "student",
      full_name: fullName,
      ...(teacherMeta ? { teacher_id: teacherMeta } : {}),
    },
  });

  if (createErr) {
    return { error: createErr.message };
  }

  revalidatePath("/admin");
  return {};
}

export async function setStudentTeacher(
  studentId: string,
  teacherId: string | null
): Promise<ActionResult> {
  const gate = await requireAdminProfile();
  if (gate.error) return { error: gate.error };

  const sid = studentId?.trim();
  if (!sid) return { error: "Öğrenci seçilemedi." };

  const supabase = await createServerActionClient();

  if (teacherId) {
    const { data: t } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", teacherId)
      .eq("role", "teacher")
      .maybeSingle();
    if (!t) return { error: "Geçersiz öğretmen." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ teacher_id: teacherId })
    .eq("id", sid)
    .eq("role", "student");

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {};
}

export async function deleteStudentUser(studentId: string): Promise<ActionResult> {
  const gate = await requireAdminProfile();
  if (gate.error || !gate.user) return { error: gate.error ?? "Yetkisiz." };

  const sid = studentId?.trim();
  if (!sid) return { error: "Geçersiz öğrenci." };
  if (sid === gate.user.id) {
    return { error: "Yönetici hesabını silemezsiniz." };
  }

  let admin;
  try {
    admin = createServerAdminClient();
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Sunucu yapılandırması eksik (SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(sid);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {};
}
