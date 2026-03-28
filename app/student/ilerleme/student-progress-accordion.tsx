"use client";

import { BookOpen, ChevronRight, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  clearStudentTopicQuestionStats,
  subtractStudentTopicQuestionsDelta,
} from "@/app/student/actions";
import {
  deleteTeacherStudentTopicCompletion,
  setTeacherStudentTopicQuestionsSolved,
} from "@/app/teacher/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudentAddQuestionsForm } from "@/components/student-add-questions-form";
import { cn } from "@/lib/utils";

type SubjectLite = {
  id: string;
  name: string;
  sort_order: number;
  slug?: string;
};
type TopicLite = {
  id: string;
  name: string;
  sort_order: number;
  subject_id: string;
};

type Props = {
  subjects: SubjectLite[];
  topics: TopicLite[];
  completedTopicIds: string[];
  solvedByTopicId: Record<string, number>;
  /** Öğretmen /ilerleme: seçili öğrenci — verilirse tamamlama iptal ve soru düzenleme */
  teacherStudentId?: string;
};

type ConfirmKonu = { topicId: string; topicName: string };

type TabId = "konu" | "soru";

export function StudentProgressAccordion({
  subjects,
  topics,
  completedTopicIds,
  solvedByTopicId,
  teacherStudentId,
}: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [studentQPending, startStudentQTransition] = useTransition();
  const [tab, setTab] = useState<TabId>("konu");
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [confirmKonu, setConfirmKonu] = useState<ConfirmKonu | null>(null);
  const [soruEdit, setSoruEdit] = useState<ConfirmKonu | null>(null);
  const [soruInput, setSoruInput] = useState("");
  const [studentSoruAdjust, setStudentSoruAdjust] = useState<{
    topicId: string;
    topicName: string;
    solved: number;
  } | null>(null);
  const [studentSubtractInput, setStudentSubtractInput] = useState("");
  const [studentSoruClear, setStudentSoruClear] = useState<ConfirmKonu | null>(
    null
  );

  const isTeacherMode = Boolean(teacherStudentId);

  function handleConfirmKonuDelete() {
    const target = confirmKonu;
    const sid = teacherStudentId;
    if (!target || !sid) return;

    void (async () => {
      setDeleting(true);
      try {
        const res = await deleteTeacherStudentTopicCompletion(sid, target.topicId);
        if (res.error) {
          alert(res.error);
          return;
        }
        setConfirmKonu(null);
        router.refresh();
      } finally {
        setDeleting(false);
      }
    })();
  }

  function runStudentSubtract(topicId: string, amount: number) {
    startStudentQTransition(async () => {
      const res = await subtractStudentTopicQuestionsDelta(topicId, amount);
      if (res.error) {
        alert(res.error);
        return;
      }
      setStudentSoruAdjust(null);
      setStudentSubtractInput("");
      router.refresh();
    });
  }

  function handleStudentSubtractSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentSoruAdjust) return;
    const n = Number.parseInt(studentSubtractInput.replace(/\s/g, ""), 10);
    if (!Number.isFinite(n) || n < 1) {
      alert("1 veya daha büyük bir tam sayı girin.");
      return;
    }
    runStudentSubtract(studentSoruAdjust.topicId, n);
  }

  function handleConfirmStudentClear() {
    const t = studentSoruClear;
    if (!t) return;
    startStudentQTransition(async () => {
      const res = await clearStudentTopicQuestionStats(t.topicId);
      if (res.error) {
        alert(res.error);
        return;
      }
      setStudentSoruClear(null);
      router.refresh();
    });
  }

  function handleSaveSoruCount() {
    const target = soruEdit;
    const sid = teacherStudentId;
    if (!target || !sid) return;

    const parsed = Number.parseInt(soruInput.replace(/\s/g, ""), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      alert("Geçerli bir tam sayı girin (0 veya daha büyük).");
      return;
    }

    void (async () => {
      setDeleting(true);
      try {
        const res = await setTeacherStudentTopicQuestionsSolved(sid, target.topicId, parsed);
        if (res.error) {
          alert(res.error);
          return;
        }
        setSoruEdit(null);
        router.refresh();
      } finally {
        setDeleting(false);
      }
    })();
  }

  const done = useMemo(
    () => new Set(completedTopicIds),
    [completedTopicIds]
  );

  const topicStats = useMemo(() => {
    const total = topics.length;
    const completed = topics.filter((t) => done.has(t.id)).length;
    return {
      total,
      completed,
      pct: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [topics, done]);

  const questionStats = useMemo(() => {
    let totalSolved = 0;
    let topicsWithActivity = 0;
    for (const t of topics) {
      const n = solvedByTopicId[t.id] ?? 0;
      totalSolved += n;
      if (n > 0) topicsWithActivity += 1;
    }
    return { totalSolved, topicsWithActivity };
  }, [topics, solvedByTopicId]);

  function toggleSubject(subjectId: string) {
    setOpenSubjects((prev) => ({ ...prev, [subjectId]: !prev[subjectId] }));
  }

  return (
    <div className="space-y-0">
      {/* Sekmeler — alt çizgi, ek kutu yok */}
      <div
        className="flex flex-col gap-4 border-b border-border/40 pb-4"
        role="tablist"
        aria-label="İlerleme türü"
      >
        <div className="flex w-full gap-0 sm:max-w-md">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "konu"}
            onClick={() => setTab("konu")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-2 px-2 py-3 text-sm font-medium transition-colors sm:px-4",
              tab === "konu"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="size-4 shrink-0" aria-hidden />
            Konu ilerlemesi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "soru"}
            onClick={() => setTab("soru")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-2 px-2 py-3 text-sm font-medium transition-colors sm:px-4",
              tab === "soru"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Hash className="size-4 shrink-0" aria-hidden />
            Soru ilerlemesi
          </button>
        </div>

        {isTeacherMode && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Öğrenci yanlışlıkla tamamladıysa konu satırında{" "}
            <span className="font-medium text-foreground">Tamamlamayı iptal</span>, soru sayısını
            düzeltmek için soru sekmesinde{" "}
            <span className="font-medium text-foreground">Düzenle</span> ile yeni değeri girin (0 =
            bu konuda kayıt yok).
          </p>
        )}

        {tab === "soru" && (
          <>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Çözülen soru toplamı
              </span>
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                {questionStats.totalSolved.toLocaleString("tr-TR")}
              </span>
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {questionStats.topicsWithActivity}
                </span>{" "}
                konuda kayıt
              </span>
            </div>
            {!isTeacherMode && (
              <StudentAddQuestionsForm subjects={subjects} topics={topics} />
            )}
          </>
        )}

        {tab === "konu" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Genel konu ilerlemesi
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                {topicStats.completed}
                <span className="text-lg font-normal text-muted-foreground">
                  {" "}
                  / {topicStats.total}
                </span>
                <span className="ml-2 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  %{topicStats.pct}
                </span>
              </p>
            </div>
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted sm:mb-1">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
                style={{ width: `${topicStats.pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Ders listeleri — ayırıcı çizgiler, ek kart yok */}
      <div className="mt-5 divide-y divide-border/50">
        {subjects.map((subj) => {
          const subTopics = topics
            .filter((t) => t.subject_id === subj.id)
            .sort((a, b) => a.sort_order - b.sort_order);
          const isOpen = Boolean(openSubjects[subj.id]);

          const totalInSubject = subTopics.length;
          const completedInSubject = subTopics.filter((t) =>
            done.has(t.id)
          ).length;
          const pctSubject =
            totalInSubject > 0
              ? Math.round((completedInSubject / totalInSubject) * 100)
              : 0;

          const solvedInSubject = subTopics.reduce(
            (acc, t) => acc + (solvedByTopicId[t.id] ?? 0),
            0
          );

          return (
            <div key={subj.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSubject(subj.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 py-4 text-left transition hover:bg-muted/20"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-semibold leading-snug text-foreground">
                      {subj.name}
                    </span>
                    <ChevronRight
                      className={cn(
                        "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-200",
                        isOpen && "rotate-90"
                      )}
                      aria-hidden
                    />
                  </div>
                  {tab === "konu" && totalInSubject > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Konu anlatımı kapsamı
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="h-2 min-w-[100px] flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
                            style={{ width: `${pctSubject}%` }}
                          />
                        </div>
                        <div className="flex items-baseline gap-2 tabular-nums">
                          <span className="text-sm font-semibold text-foreground">
                            {completedInSubject}
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              / {totalInSubject}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            %{pctSubject}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {tab === "soru" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Bu derste toplam{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {solvedInSubject.toLocaleString("tr-TR")}
                      </span>{" "}
                      soru çözüldü
                    </p>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="pb-3 pl-1 sm:pl-2">
                  <ul className="space-y-0">
                    {subTopics.map((tp) => {
                      const completed = done.has(tp.id);
                      const solved = solvedByTopicId[tp.id] ?? 0;

                      if (tab === "konu") {
                        return (
                          <li
                            key={tp.id}
                            className="flex items-center justify-between gap-2 border-b border-border/30 py-2.5 last:border-b-0 sm:gap-3"
                          >
                            <span className="min-w-0 flex-1 text-sm leading-snug text-foreground">
                              {tp.name}
                            </span>
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                              {completed ? (
                                <span className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                                  Tamamlandı
                                </span>
                              ) : (
                                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                  Eksik
                                </span>
                              )}
                              {isTeacherMode && completed && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground"
                                  disabled={deleting}
                                  onClick={() =>
                                    setConfirmKonu({
                                      topicId: tp.id,
                                      topicName: tp.name,
                                    })
                                  }
                                >
                                  Tamamlamayı iptal
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      }

                      return (
                        <li
                          key={tp.id}
                          className="flex items-center justify-between gap-2 border-b border-border/30 py-2.5 last:border-b-0 sm:gap-3"
                        >
                          <span className="min-w-0 flex-1 text-sm leading-snug text-foreground">
                            {tp.name}
                          </span>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            <span
                              className={cn(
                                "tabular-nums text-sm font-semibold",
                                solved > 0
                                  ? "text-sky-700 dark:text-sky-300"
                                  : "text-muted-foreground"
                              )}
                            >
                              {solved.toLocaleString("tr-TR")}{" "}
                              <span className="font-normal text-muted-foreground">
                                soru
                              </span>
                            </span>
                            {isTeacherMode && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground"
                                disabled={deleting}
                                onClick={() => {
                                  setSoruEdit({
                                    topicId: tp.id,
                                    topicName: tp.name,
                                  });
                                  setSoruInput(String(solved));
                                }}
                              >
                                Düzenle
                              </Button>
                            )}
                            {!isTeacherMode && solved > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg px-2.5 text-xs"
                                disabled={studentQPending}
                                onClick={() => {
                                  setStudentSubtractInput("");
                                  setStudentSoruAdjust({
                                    topicId: tp.id,
                                    topicName: tp.name,
                                    solved,
                                  });
                                }}
                              >
                                Azalt / sil
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={!!confirmKonu}
        onOpenChange={(open) => {
          if (!open) setConfirmKonu(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Konu tamamlamasını iptal et?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmKonu
                ? `“${confirmKonu.topicName}” bu öğrenci için tamamlanmış görünmeyecek. Görevle eklenen takip soru sayısı da geri alınır.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl" disabled={deleting}>
              Vazgeç
            </AlertDialogCancel>
            <Button
              type="button"
              className="rounded-2xl"
              disabled={deleting}
              onClick={handleConfirmKonuDelete}
            >
              {deleting ? "…" : "Onayla"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!soruEdit}
        onOpenChange={(open) => {
          if (!open) setSoruEdit(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>Çözülen soru sayısı</DialogTitle>
            <DialogDescription>
              {soruEdit
                ? `“${soruEdit.topicName}” için yeni değeri girin. Tüm konuları etkilemez; yalnızca bu konu.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1">
            <Label htmlFor="soru-sayisi">Soru sayısı</Label>
            <Input
              id="soru-sayisi"
              inputMode="numeric"
              autoComplete="off"
              value={soruInput}
              onChange={(e) => setSoruInput(e.target.value)}
              disabled={deleting}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={deleting}
              onClick={() => setSoruEdit(null)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              disabled={deleting}
              onClick={handleSaveSoruCount}
            >
              {deleting ? "…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!studentSoruAdjust}
        onOpenChange={(open) => {
          if (!open) {
            setStudentSoruAdjust(null);
            setStudentSubtractInput("");
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Soru kaydını düzenle</DialogTitle>
            <DialogDescription>
              {studentSoruAdjust ? (
                <>
                  <span className="font-medium text-foreground">
                    {studentSoruAdjust.topicName}
                  </span>{" "}
                  için kayıtlı çözülen soru:{" "}
                  <span className="tabular-nums font-semibold text-foreground">
                    {studentSoruAdjust.solved.toLocaleString("tr-TR")}
                  </span>
                  . Hatalı eklemeleri düşürebilir veya kaydı tamamen
                  silebilirsiniz.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {studentSoruAdjust && (
            <div className="grid gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Hızlı düşür
                </p>
                <div className="flex flex-wrap gap-2">
                  {([10, 20, 30, 40] as const).map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="min-w-[3.25rem] rounded-xl font-semibold tabular-nums"
                      disabled={studentQPending}
                      onClick={() =>
                        runStudentSubtract(studentSoruAdjust.topicId, n)
                      }
                    >
                      −{n}
                    </Button>
                  ))}
                </div>
              </div>
              <form
                onSubmit={handleStudentSubtractSubmit}
                className="grid gap-2"
              >
                <Label htmlFor="stu-subtract-n">Düşürülecek soru sayısı</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Input
                    id="stu-subtract-n"
                    inputMode="numeric"
                    placeholder="Örn. 15"
                    value={studentSubtractInput}
                    onChange={(e) => setStudentSubtractInput(e.target.value)}
                    disabled={studentQPending}
                    className="rounded-xl sm:max-w-[200px]"
                    autoComplete="off"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="rounded-xl"
                    disabled={studentQPending}
                  >
                    Düşür
                  </Button>
                </div>
              </form>
              <Button
                type="button"
                variant="destructive"
                className="rounded-xl"
                disabled={studentQPending}
                onClick={() => {
                  if (!studentSoruAdjust) return;
                  setStudentSoruClear({
                    topicId: studentSoruAdjust.topicId,
                    topicName: studentSoruAdjust.topicName,
                  });
                  setStudentSoruAdjust(null);
                  setStudentSubtractInput("");
                }}
              >
                Bu konudaki kaydı tamamen sil
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!studentSoruClear}
        onOpenChange={(open) => {
          if (!open) setStudentSoruClear(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Konu soru kaydını sil?</AlertDialogTitle>
            <AlertDialogDescription>
              {studentSoruClear
                ? `“${studentSoruClear.topicName}” için çözülen soru toplamı sıfırlanır. Bu işlem geri alınamaz.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl" disabled={studentQPending}>
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={studentQPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmStudentClear();
              }}
            >
              {studentQPending ? "…" : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
