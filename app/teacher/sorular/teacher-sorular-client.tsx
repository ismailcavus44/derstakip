"use client";

import { ChevronDown, FileQuestion, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  teacherDeleteSubmissionAnswer,
  teacherUploadSubmissionAnswer,
  type TeacherStudentQuestionSubmissionRow,
} from "@/app/teacher/actions";
import { AnswerFileLink } from "@/components/answer-file-link";
import { appPanelClassName } from "@/components/app-shell";
import { QuestionSubmissionInline } from "@/components/question-submission-inline";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QUESTION_ISSUE_KIND_LABELS } from "@/lib/question-issue-kind";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type Props = {
  rows: TeacherStudentQuestionSubmissionRow[];
};

export function TeacherSorularClient({ rows }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadForId, setUploadForId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [answeredOpen, setAnsweredOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { pending, answered } = useMemo(() => {
    const p: TeacherStudentQuestionSubmissionRow[] = [];
    const a: TeacherStudentQuestionSubmissionRow[] = [];
    for (const r of rows) {
      if (r.answer_status === "pending") p.push(r);
      else a.push(r);
    }
    return { pending: p, answered: a };
  }, [rows]);

  function submitAnswer(e: React.FormEvent<HTMLFormElement>, submissionId: string) {
    e.preventDefault();
    setUploadError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await teacherUploadSubmissionAnswer(submissionId, fd);
      if (res.error) {
        setUploadError(res.error);
        return;
      }
      setUploadForId(null);
      form.reset();
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      const res = await teacherDeleteSubmissionAnswer(id);
      if (res.error) window.alert(res.error);
      router.refresh();
    });
  }

  function renderCard(r: TeacherStudentQuestionSubmissionRow) {
    const line = [r.subject_name, r.topic_name].filter(Boolean).join(" · ");
    const showUploadForm =
      uploadForId === r.id &&
      (r.answer_status === "pending" || r.answer_status === "answered");

    return (
      <li key={r.id}>
        <Card className="rounded-3xl border-border/60">
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{r.student_name}</p>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Badge
                  variant="outline"
                  className={
                    r.answer_status === "answered"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                  }
                >
                  {r.answer_status === "answered" ? "Cevaplandı" : "Cevap bekliyor"}
                </Badge>
                <Badge variant="secondary" className="font-normal">
                  {QUESTION_ISSUE_KIND_LABELS[r.issue_kind]}
                </Badge>
              </div>
            </div>
            {line && (
              <p className="text-xs font-medium text-primary">{line}</p>
            )}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Soru</p>
              <QuestionSubmissionInline
                key={r.id}
                submissionId={r.id}
                variant="teacher"
                fileName={r.file_name}
                contentType={r.content_type}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {r.answer_status === "pending" && (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  disabled={isPending}
                  onClick={() => {
                    setUploadError(null);
                    setUploadForId((id) => (id === r.id ? null : r.id));
                  }}
                >
                  <Upload className="mr-1 size-3.5" />
                  Cevap yükle
                </Button>
              )}
              {r.answer_status === "answered" && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={isPending}
                    onClick={() => {
                      setUploadError(null);
                      setUploadForId((id) => (id === r.id ? null : r.id));
                    }}
                  >
                    <Upload className="mr-1 size-3.5" />
                    Yeni cevap yükle
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    disabled={isPending}
                    onClick={() => setDeleteId(r.id)}
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Cevabı sil
                  </Button>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {r.size_bytes < 1024 * 1024
                  ? `${Math.round(r.size_bytes / 1024)} KB`
                  : `${(r.size_bytes / (1024 * 1024)).toFixed(1)} MB`}
              </span>
            </div>
            {r.answer_status === "answered" && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Cevap dosyası
                </p>
                <AnswerFileLink
                  submissionId={r.id}
                  variant="teacher"
                  fileName={r.answer_file_name?.trim() || "cevap_goruntusu"}
                />
              </div>
            )}
            {showUploadForm && (
              <form
                className="space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3"
                onSubmit={(e) => submitAnswer(e, r.id)}
              >
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG veya WebP — en fazla 10 MB. Yükleme mevcut cevabın yerine
                  geçer.
                </p>
                <input
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  disabled={isPending}
                  className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-2 file:py-1.5 file:text-[11px] file:font-medium file:text-primary-foreground"
                />
                {uploadError && (
                  <p className="text-xs text-destructive">{uploadError}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="rounded-lg"
                    disabled={isPending}
                  >
                    {isPending ? "Yükleniyor…" : "Gönder"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-lg"
                    onClick={() => {
                      setUploadForId(null);
                      setUploadError(null);
                    }}
                  >
                    İptal
                  </Button>
                </div>
              </form>
            )}
            <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
          </CardContent>
        </Card>
      </li>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-4 pb-16 pt-6">
      <div
        className={cn(
          appPanelClassName(
            "border-sky-200/50 bg-gradient-to-br from-sky-50/85 via-card/90 to-card/80 dark:border-sky-900/40 dark:from-sky-950/35 dark:via-card/80 dark:to-card/70"
          ),
          "p-5 sm:p-6"
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md ring-4 ring-primary/15">
            <FileQuestion className="size-6" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sorular
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Bekleyen ve cevaplanmış listeler varsayılan olarak kapalıdır; başlığa tıklayınca
              açılır. Cevabı silebilir veya yeni görsel yükleyebilirsiniz.{" "}
              <Link
                href="/teacher/konu-eksikleri"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Konu eksik takibi
              </Link>{" "}
              sayfasında öğrenci bazlı konu özetini görebilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-border/80 bg-muted/30">
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Henüz gönderilmiş soru dosyası yok.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] dark:border-amber-500/20 dark:bg-amber-950/20">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-amber-500/10 dark:hover:bg-amber-950/30"
                onClick={() => setPendingOpen((o) => !o)}
                aria-expanded={pendingOpen}
              >
                <span className="text-sm font-semibold text-foreground">
                  Cevap bekleyen ({pending.length})
                </span>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform",
                    pendingOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
              {pendingOpen && (
                <div className="border-t border-amber-500/20 px-2 pb-4 pt-2 dark:border-amber-500/15">
                  <ul className="flex flex-col gap-3">{pending.map(renderCard)}</ul>
                </div>
              )}
            </div>
          )}

          {answered.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] dark:border-emerald-500/20 dark:bg-emerald-950/20">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-emerald-500/10 dark:hover:bg-emerald-950/30"
                onClick={() => setAnsweredOpen((o) => !o)}
                aria-expanded={answeredOpen}
              >
                <span className="text-sm font-semibold text-foreground">
                  Cevaplanmış ({answered.length})
                </span>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform",
                    answeredOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
              {answeredOpen && (
                <div className="border-t border-emerald-500/20 px-2 pb-4 pt-2 dark:border-emerald-500/15">
                  <ul className="flex flex-col gap-3">{answered.map(renderCard)}</ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cevabı sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Cevap görseli kalıcı olarak kaldırılır; kayıt yeniden &quot;cevap
              bekliyor&quot; olur. Öğrenci tarafında da cevap kalkar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
