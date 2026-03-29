"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  QUESTION_ANSWER_BUCKET,
  QUESTION_ANSWER_SIGNED_URL_SEC,
} from "@/lib/student-question-answers";
import { parseQuestionIssueKind } from "@/lib/question-issue-kind";
import {
  MAX_STUDENT_QUESTION_BYTES,
  STUDENT_QUESTION_ALLOWED_TYPES,
  STUDENT_QUESTION_BUCKET,
  STUDENT_QUESTION_SIGNED_URL_SEC,
} from "@/lib/student-question-uploads";
import { createServerActionClient } from "@/lib/supabase/server";

export type CompleteTaskResult = { error?: string };

const DEFAULT_FOLLOWUP_QUESTIONS = 20;

async function incrementTopicQuestionsSolved(
  supabase: Awaited<ReturnType<typeof createServerActionClient>>,
  studentId: string,
  topicId: string,
  add: number
) {
  const n =
    typeof add === "number" && Number.isFinite(add) && add > 0
      ? Math.floor(add)
      : 0;
  if (n <= 0) return;

  const { data: existing } = await supabase
    .from("student_topic_question_stats")
    .select("questions_solved")
    .eq("student_id", studentId)
    .eq("topic_id", topicId)
    .maybeSingle();

  const nextTotal = (existing?.questions_solved ?? 0) + n;
  if (nextTotal > 10_000_000) {
    console.error("incrementTopicQuestionsSolved: üst sınır aşıldı");
    return;
  }

  if (existing) {
    const { error: uErr } = await supabase
      .from("student_topic_question_stats")
      .update({
        questions_solved: nextTotal,
      })
      .eq("student_id", studentId)
      .eq("topic_id", topicId);
    if (uErr) console.error("incrementTopicQuestionsSolved update:", uErr.message);
  } else {
    const { error: iErr } = await supabase
      .from("student_topic_question_stats")
      .insert({
        student_id: studentId,
        topic_id: topicId,
        questions_solved: n,
      });
    if (iErr) console.error("incrementTopicQuestionsSolved insert:", iErr.message);
  }
}

const MAX_DELTA_PER_REQUEST = 1_000_000;
const MAX_TOTAL_QUESTIONS = 10_000_000;

/** Öğrenci: seçilen konuya çözülen soru sayısı ekler (soru ilerlemesi). */
export async function addStudentTopicQuestionsDelta(
  topicId: string,
  delta: number
): Promise<CompleteTaskResult> {
  const tid = topicId?.trim();
  if (!tid) {
    return { error: "Konu seçin." };
  }

  const raw = Number(delta);
  if (!Number.isFinite(raw) || raw <= 0) {
    return { error: "Geçerli bir pozitif sayı girin." };
  }
  const n = Math.floor(raw);
  if (n > MAX_DELTA_PER_REQUEST) {
    return { error: `Tek seferde en fazla ${MAX_DELTA_PER_REQUEST.toLocaleString("tr-TR")} soru eklenebilir.` };
  }

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "student") {
    return { error: "Bu işlem yalnızca öğrenciler içindir." };
  }

  const { data: topicRow, error: topicErr } = await supabase
    .from("topics")
    .select("id")
    .eq("id", tid)
    .maybeSingle();

  if (topicErr || !topicRow) {
    return { error: "Seçilen konu bulunamadı." };
  }

  const { data: existing } = await supabase
    .from("student_topic_question_stats")
    .select("questions_solved")
    .eq("student_id", user.id)
    .eq("topic_id", tid)
    .maybeSingle();

  const nextTotal = (existing?.questions_solved ?? 0) + n;
  if (nextTotal > MAX_TOTAL_QUESTIONS) {
    return { error: "Toplam soru üst sınırına ulaşıldı." };
  }

  if (existing) {
    const { error: uErr } = await supabase
      .from("student_topic_question_stats")
      .update({ questions_solved: nextTotal })
      .eq("student_id", user.id)
      .eq("topic_id", tid);
    if (uErr) return { error: uErr.message };
  } else {
    const { error: iErr } = await supabase
      .from("student_topic_question_stats")
      .insert({
        student_id: user.id,
        topic_id: tid,
        questions_solved: n,
      });
    if (iErr) return { error: iErr.message };
  }

  revalidatePath("/student");
  revalidatePath("/student/ilerleme");
  revalidatePath("/teacher/ilerleme");
  revalidatePath("/admin/istatistikler");
  return {};
}

/** Öğrenci: seçilen konudan soru sayısı düşürür; 0 veya altına inerse satır silinir. */
export async function subtractStudentTopicQuestionsDelta(
  topicId: string,
  delta: number
): Promise<CompleteTaskResult> {
  const tid = topicId?.trim();
  if (!tid) {
    return { error: "Konu seçin." };
  }

  const raw = Number(delta);
  if (!Number.isFinite(raw) || raw <= 0) {
    return { error: "Geçerli bir pozitif sayı girin." };
  }
  const n = Math.floor(raw);
  if (n > MAX_DELTA_PER_REQUEST) {
    return {
      error: `Tek seferde en fazla ${MAX_DELTA_PER_REQUEST.toLocaleString("tr-TR")} soru düşürülebilir.`,
    };
  }

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "student") {
    return { error: "Bu işlem yalnızca öğrenciler içindir." };
  }

  const { data: existing } = await supabase
    .from("student_topic_question_stats")
    .select("questions_solved")
    .eq("student_id", user.id)
    .eq("topic_id", tid)
    .maybeSingle();

  if (!existing) {
    return { error: "Bu konuda düşürülecek kayıt yok." };
  }

  const cur = existing.questions_solved ?? 0;
  const next = cur - n;

  if (next > 0) {
    const { error: uErr } = await supabase
      .from("student_topic_question_stats")
      .update({ questions_solved: next })
      .eq("student_id", user.id)
      .eq("topic_id", tid);
    if (uErr) return { error: uErr.message };
  } else {
    const { error: dErr } = await supabase
      .from("student_topic_question_stats")
      .delete()
      .eq("student_id", user.id)
      .eq("topic_id", tid);
    if (dErr) return { error: dErr.message };
  }

  revalidatePath("/student");
  revalidatePath("/student/ilerleme");
  revalidatePath("/teacher/ilerleme");
  revalidatePath("/admin/istatistikler");
  return {};
}

/** Öğrenci: konu için soru ilerlemesi satırını tamamen siler. */
export async function clearStudentTopicQuestionStats(
  topicId: string
): Promise<CompleteTaskResult> {
  const tid = topicId?.trim();
  if (!tid) {
    return { error: "Konu seçin." };
  }

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "student") {
    return { error: "Bu işlem yalnızca öğrenciler içindir." };
  }

  const { error: dErr } = await supabase
    .from("student_topic_question_stats")
    .delete()
    .eq("student_id", user.id)
    .eq("topic_id", tid);

  if (dErr) return { error: dErr.message };

  revalidatePath("/student");
  revalidatePath("/student/ilerleme");
  revalidatePath("/teacher/ilerleme");
  revalidatePath("/admin/istatistikler");
  return {};
}

const MAX_DENEME_QUESTIONS = 500;
const MAX_DENEME_MINUTES = 720;
const MAX_DENEME_WRONG_TOPICS = 80;

function isMissingTasksColumnError(err: { message?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return m.includes("column") && m.includes("does not exist");
}

function parseDenemeInt(
  formData: FormData,
  key: string,
  max: number
): number | null {
  const raw = formData.get(key)?.toString().trim() ?? "";
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.floor(n);
}

async function insertDenemeWrongTopicsFromForm(
  supabase: Awaited<ReturnType<typeof createServerActionClient>>,
  studentId: string,
  taskId: string,
  subjectId: string | null | undefined,
  formData: FormData
) {
  const raw = formData.getAll("deneme_wrong_topic_id");
  const ids = [
    ...new Set(
      raw
        .map((x) => x.toString().trim())
        .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    ),
  ].slice(0, MAX_DENEME_WRONG_TOPICS);

  if (ids.length === 0 || !subjectId?.trim()) return;

  const { data: validTopics, error: vErr } = await supabase
    .from("topics")
    .select("id")
    .in("id", ids)
    .eq("subject_id", subjectId.trim());

  if (vErr || !validTopics?.length) return;

  const valid = new Set(validTopics.map((t) => t.id as string));
  const rows = ids
    .filter((tid) => valid.has(tid))
    .map((topic_id) => ({
      student_id: studentId,
      topic_id,
      task_id: taskId,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("student_deneme_wrong_topics")
    .insert(rows);

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (
      error.code === "42P01" ||
      msg.includes("student_deneme_wrong_topics") ||
      msg.includes("does not exist")
    ) {
      console.error(
        "[completeTask] student_deneme_wrong_topics yok; supabase/student-deneme-wrong-topics.sql çalıştırın."
      );
      return;
    }
    console.error("insertDenemeWrongTopicsFromForm:", error.message);
  }
}

export async function completeTask(
  taskId: string,
  formData?: FormData
): Promise<CompleteTaskResult> {
  const id = taskId?.trim();
  if (!id) {
    return { error: "Geçersiz görev." };
  }

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role !== "student") {
    return { error: "Bu işlem yalnızca öğrenciler içindir." };
  }

  type TaskCompleteRow = {
    id: string;
    status: string;
    topic_id: string | null;
    subject_id?: string | null;
    task_kind: string | null;
    question_count: number | null;
    followup_question_count: number | null;
  };

  let row: TaskCompleteRow | null = null;

  const fetchFull = await supabase
    .from("tasks")
    .select(
      "id, status, topic_id, subject_id, task_kind, question_count, followup_question_count"
    )
    .eq("id", id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (fetchFull.error && isMissingTasksColumnError(fetchFull.error)) {
    const fetchLegacy = await supabase
      .from("tasks")
      .select(
        "id, status, topic_id, task_kind, question_count, followup_question_count"
      )
      .eq("id", id)
      .eq("student_id", user.id)
      .maybeSingle();
    if (fetchLegacy.error || !fetchLegacy.data) {
      return { error: "Görev bulunamadı." };
    }
    row = fetchLegacy.data as TaskCompleteRow;
  } else if (fetchFull.error || !fetchFull.data) {
    return { error: "Görev bulunamadı." };
  } else {
    row = fetchFull.data as TaskCompleteRow;
  }

  if (!row) {
    return { error: "Görev bulunamadı." };
  }

  if (row.status !== "pending") {
    return { error: "Bu görev zaten tamamlanmış veya güncellenemez." };
  }

  const taskKind = row.task_kind as string | null;

  let updatePayload: Record<string, unknown> = { status: "completed" };

  if (taskKind === "deneme_sinavi") {
    if (!formData) {
      return {
        error:
          "Deneme sınavı için doğru, yanlış ve süre (dakika) alanlarını doldurun.",
      };
    }
    const correct = parseDenemeInt(formData, "deneme_correct", MAX_DENEME_QUESTIONS);
    const wrong = parseDenemeInt(formData, "deneme_wrong", MAX_DENEME_QUESTIONS);
    const minutes = parseDenemeInt(
      formData,
      "deneme_actual_minutes",
      MAX_DENEME_MINUTES
    );
    if (correct === null || wrong === null || minutes === null) {
      return {
        error:
          "Doğru, yanlış ve süre için 0 veya pozitif tam sayı girin (süre en fazla 720 dk).",
      };
    }
    if (minutes < 1) {
      return { error: "Tamamlama süresi en az 1 dakika olmalıdır." };
    }
    updatePayload = {
      status: "completed",
      deneme_correct: correct,
      deneme_wrong: wrong,
      deneme_actual_minutes: minutes,
    };
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", id)
    .eq("student_id", user.id)
    .eq("status", "pending");

  if (updateError) {
    return { error: updateError.message };
  }

  if (taskKind === "deneme_sinavi") {
    if (formData) {
      await insertDenemeWrongTopicsFromForm(
        supabase,
        user.id,
        id,
        row.subject_id ?? null,
        formData
      );
    }
    revalidatePath("/student");
    revalidatePath("/student/ilerleme");
    revalidatePath("/student/ders-programi");
    revalidatePath("/teacher");
    revalidatePath("/teacher/ilerleme");
    revalidatePath("/teacher/konu-eksikleri");
    return {};
  }

  const kind = row.task_kind === "konu_anlatimi" ? "konu_anlatimi" : "soru_cozumu";
  const topicId = row.topic_id as string | null;

  if (topicId) {
    if (kind === "konu_anlatimi") {
      const { error: cErr } = await supabase
        .from("student_topic_completions")
        .insert({
          student_id: user.id,
          topic_id: topicId,
          task_id: id,
        });
      const duplicateCompletion = Boolean(
        cErr &&
          (cErr.code === "23505" || cErr.message?.includes("duplicate key"))
      );
      if (cErr && !duplicateCompletion) {
        console.error("completeTask completion:", cErr.message);
      }

      // Konu sonrası soru yalnızca bu konu ilk kez tamamlandıysa sayıya eklenir
      if (!cErr) {
        const followup =
          typeof row.followup_question_count === "number" &&
          Number.isFinite(row.followup_question_count) &&
          row.followup_question_count >= 0
            ? Math.floor(row.followup_question_count)
            : DEFAULT_FOLLOWUP_QUESTIONS;

        await incrementTopicQuestionsSolved(
          supabase,
          user.id,
          topicId,
          followup
        );
      }
    } else {
      await incrementTopicQuestionsSolved(
        supabase,
        user.id,
        topicId,
        row.question_count ?? 0
      );
    }
  }

  revalidatePath("/student");
  revalidatePath("/student/ilerleme");
  revalidatePath("/student/ders-programi");
  revalidatePath("/teacher");
  revalidatePath("/teacher/ilerleme");
  return {};
}

function sanitizeStudentQuestionFileBase(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return base.trim() || "dosya";
}

/** Öğrenci: seçilen konuya soru dosyası gönderir (görevden bağımsız). Bildirim DB tetikleyicisiyle öğretmene gider. */
export async function submitStudentQuestionSubmission(
  topicId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const tid = topicId?.trim();
  if (!tid) return { error: "Konu seçin." };

  const issueKind = parseQuestionIssueKind(formData.get("issue_kind"));

  const raw = formData.get("file");
  if (!raw || typeof raw === "string") {
    return { error: "Dosya seçin." };
  }
  const file = raw as File;
  if (!file.size) return { error: "Dosya boş." };
  if (file.size > MAX_STUDENT_QUESTION_BYTES) {
    return { error: "Dosya en fazla 10 MB olabilir." };
  }

  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!STUDENT_QUESTION_ALLOWED_TYPES.has(mime)) {
    return { error: "Yalnızca JPEG, PNG, WebP veya PDF yükleyebilirsin." };
  }

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, teacher_id")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "student") {
    return { error: "Bu işlem yalnızca öğrenciler içindir." };
  }
  if (!me.teacher_id) {
    return { error: "Henüz bir öğretmene atanmadığın için soru gönderemezsin." };
  }

  const { data: topicRow, error: topicErr } = await supabase
    .from("topics")
    .select("id")
    .eq("id", tid)
    .maybeSingle();

  if (topicErr || !topicRow) {
    return { error: "Seçilen konu bulunamadı." };
  }

  const safeBase = sanitizeStudentQuestionFileBase(file.name);
  const objectName = `${randomUUID()}_${safeBase}`;
  const storagePath = `${user.id}/${objectName}`;

  const { error: upErr } = await supabase.storage
    .from(STUDENT_QUESTION_BUCKET)
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
          "Depolama hazır değil. Supabase'de student-question-submissions.sql çalıştırın.",
      };
    }
    return { error: upErr.message };
  }

  const { error: insErr } = await supabase
    .from("student_question_submissions")
    .insert({
      student_id: user.id,
      topic_id: tid,
      storage_path: storagePath,
      file_name: file.name.slice(0, 200) || safeBase,
      content_type: mime,
      size_bytes: file.size,
      issue_kind: issueKind,
    });

  if (insErr) {
    await supabase.storage.from(STUDENT_QUESTION_BUCKET).remove([storagePath]);
    if (insErr.code === "42P01") {
      return {
        error:
          "Soru gönderimi henüz etkin değil. Supabase'de student-question-submissions.sql çalıştırın.",
      };
    }
    if (
      insErr.code === "42703" ||
      insErr.message?.toLowerCase().includes("issue_kind")
    ) {
      return {
        error:
          "Veritabanı güncel değil. Supabase SQL düzenleyicide student-question-issue-kind.sql dosyasını çalıştırın.",
      };
    }
    return { error: insErr.message };
  }

  revalidatePath("/student");
  revalidatePath("/student/sorularim");
  revalidatePath("/teacher");
  revalidatePath("/teacher/sorular");
  revalidatePath("/admin/ogrenci-sorulari");
  revalidatePath("/teacher/konu-eksikleri");
  return {};
}

export type StudentOwnQuestionSubmissionRow = {
  id: string;
  topic_name: string;
  subject_name: string | null;
  file_name: string;
  content_type: string | null;
  created_at: string;
  answer_status: "pending" | "answered";
  answered_at: string | null;
  answer_file_name: string | null;
};

export async function listMyQuestionSubmissions(): Promise<
  StudentOwnQuestionSubmissionRow[]
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
  if (me?.role !== "student") return [];

  const { data, error } = await supabase
    .from("student_question_submissions")
    .select(
      "id, file_name, content_type, created_at, answer_status, answered_at, answer_file_name, topics(name, subjects(name))"
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("listMyQuestionSubmissions:", error.message);
    }
    return [];
  }

  type Raw = {
    id: string;
    file_name: string;
    content_type?: string | null;
    created_at: string;
    answer_status?: string | null;
    answered_at?: string | null;
    answer_file_name?: string | null;
    topics:
      | { name: string; subjects: { name: string } | { name: string }[] | null }
      | { name: string; subjects: { name: string } | { name: string }[] | null }[]
      | null;
  };

  return ((data ?? []) as Raw[]).map((row) => {
    const top = Array.isArray(row.topics) ? row.topics[0] : row.topics;
    const subj = top?.subjects;
    const subjectName = Array.isArray(subj) ? subj[0]?.name : subj?.name;
    const st =
      row.answer_status === "answered" ? "answered" : "pending";
    return {
      id: row.id,
      topic_name: top?.name ?? "Konu",
      subject_name: subjectName ?? null,
      file_name: row.file_name,
      content_type: row.content_type ?? null,
      created_at: row.created_at,
      answer_status: st,
      answered_at: row.answered_at ?? null,
      answer_file_name: row.answer_file_name ?? null,
    };
  });
}

/** Öğrenci: kendi yüklediği soru gönderimini (ve varsa cevap dosyasını) kaldırır. */
export async function deleteMyQuestionSubmission(
  submissionId: string
): Promise<{ error?: string }> {
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
  if (me?.role !== "student") {
    return { error: "Bu işlem yalnızca öğrenciler içindir." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("student_question_submissions")
    .select(
      "id, student_id, storage_path, answer_storage_path, answer_status"
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row || row.student_id !== user.id) {
    return { error: "Kayıt bulunamadı." };
  }

  const qPath = row.storage_path as string;
  const ansPath = row.answer_storage_path as string | null;
  const answered = row.answer_status === "answered";

  if (answered && ansPath) {
    await supabase.storage.from(QUESTION_ANSWER_BUCKET).remove([ansPath]);
  }

  const { error: qRemErr } = await supabase.storage
    .from(STUDENT_QUESTION_BUCKET)
    .remove([qPath]);
  if (qRemErr) {
    console.error("deleteMyQuestionSubmission question file:", qRemErr.message);
  }

  const { error: delErr } = await supabase
    .from("student_question_submissions")
    .delete()
    .eq("id", id)
    .eq("student_id", user.id);

  if (delErr) {
    if (
      delErr.code === "42501" ||
      delErr.message?.toLowerCase().includes("policy")
    ) {
      return {
        error:
          "Silme izni yok. Supabase'de student-question-submission-student-delete.sql dosyasını çalıştırın.",
      };
    }
    return { error: delErr.message };
  }

  revalidatePath("/student");
  revalidatePath("/student/sorularim");
  revalidatePath("/teacher");
  revalidatePath("/teacher/sorular");
  revalidatePath("/admin/ogrenci-sorulari");
  revalidatePath("/teacher/konu-eksikleri");
  return {};
}

export async function getMyQuestionSubmissionQuestionUrl(
  submissionId: string
): Promise<{ error?: string; url?: string }> {
  const id = submissionId?.trim();
  if (!id) return { error: "Geçersiz kayıt." };

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: row, error } = await supabase
    .from("student_question_submissions")
    .select("storage_path, student_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!row || row.student_id !== user.id) {
    return { error: "Dosya bulunamadı." };
  }

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

export async function getMyQuestionSubmissionAnswerUrl(
  submissionId: string
): Promise<{ error?: string; url?: string }> {
  const id = submissionId?.trim();
  if (!id) return { error: "Geçersiz kayıt." };

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: row, error } = await supabase
    .from("student_question_submissions")
    .select("student_id, answer_status, answer_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!row || row.student_id !== user.id) {
    return { error: "Kayıt bulunamadı." };
  }
  if (row.answer_status !== "answered" || !row.answer_storage_path) {
    return { error: "Henüz cevap görseli yüklenmedi." };
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
