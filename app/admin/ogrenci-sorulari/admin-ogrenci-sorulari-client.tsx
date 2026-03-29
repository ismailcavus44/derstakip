"use client";

import { FileQuestion, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  adminUploadSubmissionAnswer,
  type AdminQuestionSubmissionRow,
} from "@/app/admin/actions";
import { AnswerFileLink } from "@/components/answer-file-link";
import { QuestionSubmissionInline } from "@/components/question-submission-inline";
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

type Props = { rows: AdminQuestionSubmissionRow[] };

export function AdminOgrenciSorulariClient({ rows }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadForId, setUploadForId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { pending, answered } = useMemo(() => {
    const p: AdminQuestionSubmissionRow[] = [];
    const a: AdminQuestionSubmissionRow[] = [];
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
      const res = await adminUploadSubmissionAnswer(submissionId, fd);
      if (res.error) {
        setUploadError(res.error);
        return;
      }
      setUploadForId(null);
      form.reset();
      router.refresh();
    });
  }

  function rowCard(r: AdminQuestionSubmissionRow, showUpload: boolean) {
    const line = [r.subject_name, r.topic_name].filter(Boolean).join(" · ");
    return (
      <Card key={r.id} className="rounded-2xl border-border/60">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{r.student_name}</p>
              <p className="text-xs text-muted-foreground">
                Öğretmen: {r.teacher_name ?? "—"}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  r.answer_status === "answered"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                )}
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
          <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Soru</p>
            <QuestionSubmissionInline
              key={r.id}
              submissionId={r.id}
              variant="admin"
              fileName={r.file_name}
              contentType={r.content_type}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {showUpload && r.answer_status === "pending" && (
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
          </div>
          {r.answer_status === "answered" && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Cevap dosyası</p>
              <AnswerFileLink
                submissionId={r.id}
                variant="admin"
                fileName={r.answer_file_name?.trim() || "cevap_goruntusu"}
              />
            </div>
          )}
          {showUpload && uploadForId === r.id && r.answer_status === "pending" && (
            <form
              className="space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3"
              onSubmit={(e) => submitAnswer(e, r.id)}
            >
              <p className="text-xs text-muted-foreground">
                JPEG, PNG veya WebP — en fazla 10 MB. Yükleme mevcut cevabın yerine geçer.
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
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="rounded-lg" disabled={isPending}>
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
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-16 pt-6">
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileQuestion className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Öğrenci soruları</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Soru kart içinde önizlenir; cevap yalnızca dosya adıyla listelenir (tıklanınca
              açılır). Cevap bekleyenlere görsel yükleyin.
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cevap bekleyen ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Bekleyen soru yok.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((r) => (
              <li key={r.id}>{rowCard(r, true)}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cevaplanmış ({answered.length})
        </h2>
        {answered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz cevaplanmış kayıt yok.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {answered.map((r) => (
              <li key={r.id}>{rowCard(r, false)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
