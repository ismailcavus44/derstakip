"use server";

import { createClient } from "@/lib/supabase/server";

export type SubjectRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

export type TopicRow = {
  id: string;
  name: string;
  sort_order: number;
  subject_id: string;
};

/** Müfredat tabloları henüz yok (SQL uygulanmamış) — gürültüsüz ele alınır */
function isMissingCurriculumTable(err: {
  message?: string;
  code?: string;
} | null): boolean {
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

/** Öğretmen / görev formu için tüm ders + konular */
export async function getCurriculumTree(): Promise<{
  subjects: SubjectRow[];
  topics: TopicRow[];
}> {
  const supabase = await createClient();

  const { data: subjects, error: sErr } = await supabase
    .from("subjects")
    .select("id, name, slug, sort_order")
    .order("sort_order", { ascending: true });

  if (sErr) {
    if (!isMissingCurriculumTable(sErr)) {
      console.error("getCurriculumTree subjects:", sErr.message);
    }
    return { subjects: [], topics: [] };
  }

  const { data: topics, error: tErr } = await supabase
    .from("topics")
    .select("id, name, sort_order, subject_id")
    .order("sort_order", { ascending: true });

  if (tErr) {
    if (!isMissingCurriculumTable(tErr)) {
      console.error("getCurriculumTree topics:", tErr.message);
    }
    return { subjects: subjects ?? [], topics: [] };
  }

  return {
    subjects: (subjects ?? []) as SubjectRow[],
    topics: (topics ?? []) as TopicRow[],
  };
}
