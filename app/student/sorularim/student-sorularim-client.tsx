"use client";

import { FileQuestion, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  deleteMyQuestionSubmission,
  type StudentOwnQuestionSubmissionRow,
} from "@/app/student/actions";
import { AnswerFileLink } from "@/components/answer-file-link";
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

type Props = { rows: StudentOwnQuestionSubmissionRow[] };

export function StudentSorularimClient({ rows }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.answer_status !== b.answer_status) {
        return a.answer_status === "pending" ? -1 : 1;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [rows]);

  const deleteTarget = deleteId
    ? sorted.find((r) => r.id === deleteId)
    : null;

  function confirmDelete() {
    if (!deleteId) return;
    const sid = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      const res = await deleteMyQuestionSubmission(sid);
      if (res.error) window.alert(res.error);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileQuestion className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Sorularım</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sorun kartta önizlenir; önizlemeye veya PDF satırına tıklayınca tam dosya yeni
              sekmede açılır. Cevap hazır olunca dosya adı görünür, tıklayınca cevap açılır.
              İstersen gönderdiğin soruyu silebilirsin.
            </p>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-border/80 bg-muted/30">
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Henüz soru göndermedin.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ana sayfadaki &quot;Soru yükle&quot; ile gönderebilirsin.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((r) => {
            const line = [r.subject_name, r.topic_name].filter(Boolean).join(" · ");
            return (
              <li key={r.id}>
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            r.answer_status === "answered"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                          )}
                        >
                          {r.answer_status === "answered"
                            ? "Cevaplandı"
                            : "Cevap bekleniyor"}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={isPending}
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="mr-1 size-3.5" aria-hidden />
                          Sil
                        </Button>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    {line && (
                      <p className="text-xs font-medium text-primary">{line}</p>
                    )}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Soru</p>
                      <QuestionSubmissionInline
                        key={r.id}
                        submissionId={r.id}
                        variant="student"
                        fileName={r.file_name}
                        contentType={r.content_type}
                      />
                    </div>
                    {r.answer_status === "answered" && r.answered_at && (
                      <p className="text-xs text-muted-foreground">
                        Cevap tarihi: {formatDate(r.answered_at)}
                      </p>
                    )}
                    {r.answer_status === "answered" && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Cevap dosyası
                        </p>
                        <AnswerFileLink
                          submissionId={r.id}
                          variant="student"
                          fileName={
                            r.answer_file_name?.trim() || "cevap_goruntusu"
                          }
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Soru gönderimini sil?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.answer_status === "answered"
                ? "Soru dosyası ve öğretmenin yüklediği cevap görseli kaldırılır. Bu işlem geri alınamaz."
                : "Soru dosyası kaldırılır; öğretmen artık bu gönderimi görmez. Bu işlem geri alınamaz."}
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
