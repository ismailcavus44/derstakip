"use server";

import { revalidatePath } from "next/cache";

import { createServerActionClient } from "@/lib/supabase/server";

export type ScheduleActionResult = { error?: string };

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00");
  return !Number.isNaN(d.getTime());
}

function validateMinutes(start: number, end: number): string | null {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return "Geçersiz saat.";
  }
  const s = Math.floor(start);
  const e = Math.floor(end);
  if (s < 0 || s >= 1440 || e <= 0 || e > 1440) {
    return "Saat 00:00–24:00 aralığında olmalı.";
  }
  if (e <= s) {
    return "Bitiş, başlangıçtan sonra olmalı.";
  }
  if (e - s < 15) {
    return "En az 15 dakikalık aralık seçin.";
  }
  return null;
}

export async function createScheduleEntry(input: {
  taskId: string;
  scheduledDate: string;
  startMinutes: number;
  endMinutes: number;
}): Promise<ScheduleActionResult> {
  const taskId = input.taskId?.trim();
  const scheduledDate = input.scheduledDate?.trim();
  if (!taskId) {
    return { error: "Görev seçin." };
  }
  if (!scheduledDate || !isValidIsoDate(scheduledDate)) {
    return { error: "Geçersiz tarih." };
  }

  const timeErr = validateMinutes(input.startMinutes, input.endMinutes);
  if (timeErr) {
    return { error: timeErr };
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

  const { error } = await supabase.from("student_schedule_entries").insert({
    student_id: user.id,
    task_id: taskId,
    scheduled_date: scheduledDate,
    start_minutes: Math.floor(input.startMinutes),
    end_minutes: Math.floor(input.endMinutes),
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Bu görev bu güne zaten eklenmiş." };
    }
    if (
      error.message?.includes("student_schedule_entries") ||
      error.message?.includes("start_minutes")
    ) {
      return {
        error:
          "Program tablosu güncel değil. Supabase’de supabase/student-schedule.sql dosyasını çalıştırın.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/student/ders-programi");
  return {};
}

export async function deleteScheduleEntry(entryId: string): Promise<ScheduleActionResult> {
  const id = entryId?.trim();
  if (!id) {
    return { error: "Geçersiz kayıt." };
  }

  const supabase = await createServerActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { error } = await supabase
    .from("student_schedule_entries")
    .delete()
    .eq("id", id)
    .eq("student_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/student/ders-programi");
  return {};
}
