"use server";

import { revalidatePath } from "next/cache";
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

export async function completeTask(taskId: string): Promise<CompleteTaskResult> {
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

  const { data: row, error: fetchError } = await supabase
    .from("tasks")
    .select(
      "id, status, topic_id, task_kind, question_count, followup_question_count"
    )
    .eq("id", id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (fetchError || !row) {
    return { error: "Görev bulunamadı." };
  }

  if (row.status !== "pending") {
    return { error: "Bu görev zaten tamamlanmış veya güncellenemez." };
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: "completed" })
    .eq("id", id)
    .eq("student_id", user.id)
    .eq("status", "pending");

  if (updateError) {
    return { error: updateError.message };
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
