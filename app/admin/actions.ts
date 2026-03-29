"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getCachedAuth } from "@/lib/auth/cached-auth";
import {
  parseQuestionIssueKind,
  type QuestionIssueKind,
} from "@/lib/question-issue-kind";
import {
  MAX_QUESTION_ANSWER_BYTES,
  QUESTION_ANSWER_ALLOWED_TYPES,
  QUESTION_ANSWER_BUCKET,
} from "@/lib/student-question-answers";
import { STUDENT_QUESTION_BUCKET } from "@/lib/student-question-uploads";
import { createServerActionClient } from "@/lib/supabase/server";
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
  const { user, profile } = await getCachedAuth();
  if (!user || profile?.role !== "admin") return null;

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
  const { user, profile } = await getCachedAuth();
  if (!user || profile?.role !== "admin") return null;

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

export type AdminQuestionSubmissionRow = {
  id: string;
  student_id: string;
  student_name: string;
  teacher_name: string | null;
  topic_name: string;
  subject_name: string | null;
  file_name: string;
  content_type: string | null;
  created_at: string;
  answer_status: "pending" | "answered";
  answered_at: string | null;
  answer_file_name: string | null;
  issue_kind: QuestionIssueKind;
};

function sanitizeAnswerFileBase(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return base.trim() || "cevap";
}

export async function getAdminQuestionSubmissions(): Promise<
  AdminQuestionSubmissionRow[]
> {
  const gate = await requireAdminProfile();
  if (gate.error || !gate.user) return [];

  let admin;
  try {
    admin = createServerAdminClient();
  } catch {
    return [];
  }

  const { data, error } = await admin
    .from("student_question_submissions")
    .select(
      "id, student_id, topic_id, file_name, created_at, answer_status, answered_at, answer_file_name, issue_kind, profiles!student_question_submissions_student_id_fkey(full_name, teacher_id), topics(name, subjects(name))"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("getAdminQuestionSubmissions:", error.message);
    }
    return [];
  }

  type Raw = {
    id: string;
    student_id: string;
    topic_id: string;
    file_name: string;
    content_type?: string | null;
    created_at: string;
    answer_status: string;
    answered_at: string | null;
    answer_file_name?: string | null;
    issue_kind?: string | null;
    profiles:
      | { full_name: string | null; teacher_id: string | null }
      | { full_name: string | null; teacher_id: string | null }[]
      | null;
    topics:
      | {
          name: string;
          subjects:
            | { name: string }
            | { name: string }[]
            | null;
        }
      | null
      | unknown[];
  };

  const rows = (data ?? []) as Raw[];
  const teacherIds = [
    ...new Set(
      rows
        .map((r) => {
          const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return p?.teacher_id ?? null;
        })
        .filter((id): id is string => !!id)
    ),
  ];

  let teacherNameById = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);
    teacherNameById = new Map(
      (teachers ?? []).map((t) => [
        t.id as string,
        ((t.full_name as string) ?? "").trim() || "—",
      ])
    );
  }

  return rows.map((row) => {
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const top = Array.isArray(row.topics) ? row.topics[0] : row.topics;
    const subj =
      top && typeof top === "object" && "subjects" in top
        ? (top as { subjects: unknown }).subjects
        : null;
    const subjectName = Array.isArray(subj)
      ? (subj[0] as { name?: string })?.name
      : (subj as { name?: string } | null)?.name;
    const st = row.answer_status === "answered" ? "answered" : "pending";
    return {
      id: row.id,
      student_id: row.student_id,
      student_name: prof?.full_name?.trim() || "Öğrenci",
      teacher_name: prof?.teacher_id
        ? teacherNameById.get(prof.teacher_id) ?? null
        : null,
      topic_name:
        top && typeof top === "object" && "name" in top
          ? String((top as { name: string }).name)
          : "Konu",
      subject_name: subjectName ?? null,
      file_name: row.file_name,
      content_type: row.content_type ?? null,
      created_at: row.created_at,
      answer_status: st,
      answered_at: row.answered_at,
      answer_file_name: row.answer_file_name ?? null,
      issue_kind: parseQuestionIssueKind(row.issue_kind),
    };
  });
}

/** Yönetici: öğrenci sorusuna cevap görseli yükler (JPEG/PNG/WebP). */
export async function adminUploadSubmissionAnswer(
  submissionId: string,
  formData: FormData
): Promise<ActionResult> {
  const gate = await requireAdminProfile();
  if (gate.error || !gate.user) return { error: gate.error ?? "Yetkisiz." };

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

  let admin;
  try {
    admin = createServerAdminClient();
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "SUPABASE_SERVICE_ROLE_KEY eksik.",
    };
  }

  const { data: row, error: fetchErr } = await admin
    .from("student_question_submissions")
    .select("id, student_id, answer_storage_path")
    .eq("id", sid)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Kayıt bulunamadı." };

  const studentId = row.student_id as string;
  const oldPath = row.answer_storage_path as string | null;

  const safeBase = sanitizeAnswerFileBase(file.name);
  const objectName = `${randomUUID()}_${safeBase}`;
  const storagePath = `${studentId}/${sid}/${objectName}`;

  const { error: upErr } = await admin.storage
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
          "Cevap deposu yok. Supabase'de student-question-answers.sql çalıştırın.",
      };
    }
    return { error: upErr.message };
  }

  if (oldPath) {
    await admin.storage.from(QUESTION_ANSWER_BUCKET).remove([oldPath]);
  }

  const { error: updErr } = await admin
    .from("student_question_submissions")
    .update({
      answer_status: "answered",
      answer_storage_path: storagePath,
      answer_file_name: file.name.slice(0, 200) || safeBase,
      answer_content_type: mime,
      answer_size_bytes: file.size,
      answered_at: new Date().toISOString(),
      answered_by: gate.user.id,
    })
    .eq("id", sid);

  if (updErr) {
    await admin.storage.from(QUESTION_ANSWER_BUCKET).remove([storagePath]);
    if (updErr.code === "42703" || updErr.message?.includes("answer_status")) {
      return {
        error:
          "Veritabanı güncel değil. student-question-answers.sql dosyasını çalıştırın.",
      };
    }
    return { error: updErr.message };
  }

  revalidatePath("/admin/ogrenci-sorulari");
  revalidatePath("/teacher/konu-eksikleri");
  revalidatePath("/student/sorularim");
  revalidatePath("/teacher/sorular");
  return {};
}

export async function getAdminSubmissionQuestionDownloadUrl(
  submissionId: string
): Promise<{ error?: string; url?: string }> {
  const gate = await requireAdminProfile();
  if (gate.error || !gate.user) return { error: gate.error ?? "Yetkisiz." };

  const sid = submissionId?.trim();
  if (!sid) return { error: "Geçersiz kayıt." };

  let admin;
  try {
    admin = createServerAdminClient();
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "SUPABASE_SERVICE_ROLE_KEY eksik.",
    };
  }

  const { data: row, error } = await admin
    .from("student_question_submissions")
    .select("storage_path")
    .eq("id", sid)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!row?.storage_path) return { error: "Dosya bulunamadı." };

  const { data: signed, error: signErr } = await admin.storage
    .from(STUDENT_QUESTION_BUCKET)
    .createSignedUrl(row.storage_path as string, 3600);

  if (signErr || !signed?.signedUrl) {
    return { error: signErr?.message ?? "Bağlantı oluşturulamadı." };
  }
  return { url: signed.signedUrl };
}

export async function getAdminSubmissionAnswerDownloadUrl(
  submissionId: string
): Promise<{ error?: string; url?: string }> {
  const gate = await requireAdminProfile();
  if (gate.error || !gate.user) return { error: gate.error ?? "Yetkisiz." };

  const sid = submissionId?.trim();
  if (!sid) return { error: "Geçersiz kayıt." };

  let admin;
  try {
    admin = createServerAdminClient();
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "SUPABASE_SERVICE_ROLE_KEY eksik.",
    };
  }

  const { data: row, error } = await admin
    .from("student_question_submissions")
    .select("answer_storage_path, answer_status")
    .eq("id", sid)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!row || row.answer_status !== "answered" || !row.answer_storage_path) {
    return { error: "Bu kayıt için cevap görseli yok." };
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(QUESTION_ANSWER_BUCKET)
    .createSignedUrl(row.answer_storage_path as string, 3600);

  if (signErr || !signed?.signedUrl) {
    return { error: signErr?.message ?? "Bağlantı oluşturulamadı." };
  }
  return { url: signed.signedUrl };
}
