import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurriculumTree } from "@/app/curriculum/actions";
import { getStudents } from "@/app/teacher/actions";
import { StudentProgressAccordion } from "@/app/student/ilerleme/student-progress-accordion";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ ogrenci?: string }>;
};

export default async function TeacherIlerlemePage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const students = await getStudents();
  if (students.length === 0) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 pb-12 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-sm ring-1 ring-primary/25">
              <BarChart3 className="size-[1.35rem]" strokeWidth={1.75} aria-hidden />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Öğrenci ilerlemesi
            </h1>
          </div>
          <Card className="rounded-3xl border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Henüz size atanmış öğrenci yok. Öğrenci atandığında buradan konu ve soru
              ilerlemesini görebilirsiniz.
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const firstId = students[0].id;
  const requestedId = sp.ogrenci?.trim();
  const validIds = new Set(students.map((s) => s.id));

  let selectedId = firstId;
  if (requestedId && validIds.has(requestedId)) {
    selectedId = requestedId;
  } else if (requestedId && !validIds.has(requestedId)) {
    redirect(`/teacher/ilerleme?ogrenci=${firstId}`);
  } else if (!requestedId) {
    redirect(`/teacher/ilerleme?ogrenci=${firstId}`);
  }

  const { subjects, topics } = await getCurriculumTree();

  const { data: completions } = await supabase
    .from("student_topic_completions")
    .select("topic_id")
    .eq("student_id", selectedId);

  const { data: qstats } = await supabase
    .from("student_topic_question_stats")
    .select("topic_id, questions_solved")
    .eq("student_id", selectedId);

  const completedTopicIds = (completions ?? []).map((c) => c.topic_id);
  const solvedByTopicId: Record<string, number> = {};
  for (const row of qstats ?? []) {
    solvedByTopicId[row.topic_id] = row.questions_solved ?? 0;
  }

  const subjectLites = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    sort_order: s.sort_order,
    slug: s.slug,
  }));

  const selectedName =
    students.find((s) => s.id === selectedId)?.full_name?.trim() ?? "Öğrenci";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 pb-12 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-sm ring-1 ring-primary/25">
            <BarChart3 className="size-[1.35rem]" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Öğrenci ilerlemesi
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Konu anlatımı ve soru çözümü verileri seçtiğiniz öğrenciye göre listelenir.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Öğrenci seçin
          </p>
          <div className="flex flex-wrap gap-2">
            {students.map((s) => {
              const active = s.id === selectedId;
              return (
                <Link
                  key={s.id}
                  href={`/teacher/ilerleme?ogrenci=${s.id}`}
                  scroll={false}
                  className={cn(
                    "inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className="truncate">{s.full_name}</span>
                </Link>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Görüntülenen: <span className="font-medium text-foreground">{selectedName}</span>
          </p>
        </div>

        {subjects.length === 0 ? (
          <Card className="rounded-3xl border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Müfredat henüz yüklenmemiş. Supabase&apos;de curriculum-and-progress.sql
              dosyasının çalıştırıldığından emin olun.
            </CardContent>
          </Card>
        ) : (
          <StudentProgressAccordion
            subjects={subjectLites}
            topics={topics}
            completedTopicIds={completedTopicIds}
            solvedByTopicId={solvedByTopicId}
            teacherStudentId={selectedId}
          />
        )}
      </main>
    </div>
  );
}
