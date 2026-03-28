import { BarChart3 } from "lucide-react";
import { redirect } from "next/navigation";

import { getCurriculumTree } from "@/app/curriculum/actions";
import { StudentProgressAccordion } from "@/app/student/ilerleme/student-progress-accordion";
import { StudentAppHeader } from "@/components/student-app-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StudentIlerlemePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "Öğrenci";

  const { subjects, topics } = await getCurriculumTree();

  const { data: completions } = await supabase
    .from("student_topic_completions")
    .select("topic_id")
    .eq("student_id", user.id);

  const { data: qstats } = await supabase
    .from("student_topic_question_stats")
    .select("topic_id, questions_solved")
    .eq("student_id", user.id);

  const completedTopicIds = (completions ?? []).map((c) => c.topic_id);
  const solvedByTopicId: Record<string, number> = {};
  for (const row of qstats ?? []) {
    solvedByTopicId[row.topic_id] = row.questions_solved ?? 0;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <StudentAppHeader displayName={displayName} active="ilerleme" />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-14 pt-6 sm:gap-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/90 text-primary-foreground shadow-md ring-2 ring-primary/20 sm:size-12">
              <BarChart3
                className="size-[1.35rem] sm:size-6"
                strokeWidth={1.75}
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                İlerleme özeti
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Konu ve soru tamamlamalarınızı derslere göre görüntüleyin.
              </p>
            </div>
          </div>
        </div>

        {subjects.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/60 bg-transparent">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Müfredat henüz yüklenmemiş. Supabase&apos;de
              curriculum-and-progress.sql dosyasının çalıştırıldığından emin
              olun.
            </CardContent>
          </Card>
        ) : (
          <StudentProgressAccordion
            subjects={subjects}
            topics={topics}
            completedTopicIds={completedTopicIds}
            solvedByTopicId={solvedByTopicId}
          />
        )}
      </main>
    </div>
  );
}
