"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  adminDeleteStudentTopicCompletion,
  adminSetStudentTopicQuestionsSolved,
  type AdminCompletionStat,
  type AdminQuestionStat,
} from "@/app/admin/actions";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type PendingCompletionDelete = { row: AdminCompletionStat } | null;

type Props = {
  completions: AdminCompletionStat[];
  questionStats: AdminQuestionStat[];
  tablesMissing: boolean;
};

export function AdminIstatistiklerTables({
  completions,
  questionStats,
  tablesMissing,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmCompletion, setConfirmCompletion] = useState<PendingCompletionDelete>(null);
  const [questionEdit, setQuestionEdit] = useState<AdminQuestionStat | null>(null);
  const [qInput, setQInput] = useState("");

  function runDeleteCompletion() {
    if (!confirmCompletion) return;
    startTransition(async () => {
      const row = confirmCompletion.row;
      const res = await adminDeleteStudentTopicCompletion(row.student_id, row.topic_id);
      setConfirmCompletion(null);
      if (res.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  function openQuestionEdit(q: AdminQuestionStat) {
    setQuestionEdit(q);
    setQInput(String(q.questions_solved));
  }

  function saveQuestionCount() {
    if (!questionEdit) return;
    const parsed = Number.parseInt(qInput.replace(/\s/g, ""), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      alert("Geçerli bir tam sayı girin (0 veya daha büyük).");
      return;
    }
    startTransition(async () => {
      const res = await adminSetStudentTopicQuestionsSolved(
        questionEdit.student_id,
        questionEdit.topic_id,
        parsed
      );
      if (res.error) {
        alert(res.error);
        return;
      }
      setQuestionEdit(null);
      router.refresh();
    });
  }

  return (
    <>
      {tablesMissing && (
        <Card className="mb-6 rounded-3xl border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 text-sm text-amber-900 dark:text-amber-100">
            İlerleme tabloları bulunamadı. Supabase&apos;de curriculum-and-progress.sql
            dosyasını çalıştırın.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Konu tamamlamaları</CardTitle>
            <CardDescription>{completions.length} kayıt</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-2 overflow-y-auto text-sm">
            {completions.length === 0 ? (
              <p className="text-muted-foreground">Henüz kayıt yok.</p>
            ) : (
              <ul className="space-y-2">
                {completions.map((c) => (
                  <li
                    key={`${c.student_id}-${c.topic_id}`}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[c.subject_name, c.topic_name].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.completed_at)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={pending}
                      aria-label="Tamamlama kaydını sil"
                      onClick={() => setConfirmCompletion({ row: c })}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Soru çözüm toplamları</CardTitle>
            <CardDescription>{questionStats.length} konu kaydı</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-2 overflow-y-auto text-sm">
            {questionStats.length === 0 ? (
              <p className="text-muted-foreground">Henüz kayıt yok.</p>
            ) : (
              <ul className="space-y-2">
                {questionStats.map((q) => (
                  <li
                    key={`${q.student_id}-${q.topic_id}`}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{q.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[q.subject_name, q.topic_name].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-xs font-semibold text-foreground">
                        {q.questions_solved} soru
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl"
                      disabled={pending}
                      aria-label="Soru sayısını düzenle"
                      onClick={() => openQuestionEdit(q)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={!!confirmCompletion}
        onOpenChange={(open) => {
          if (!open) setConfirmCompletion(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Konu tamamlamasını sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu öğrenci için seçilen konudaki tamamlama kaydı kaldırılır. İlerleme ekranları
              güncellenir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl" disabled={pending}>
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                runDeleteCompletion();
              }}
            >
              {pending ? "Siliniyor…" : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!questionEdit}
        onOpenChange={(open) => {
          if (!open) setQuestionEdit(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>Çözülen soru sayısı</DialogTitle>
            <DialogDescription>
              {questionEdit
                ? `${questionEdit.student_name} · ${[questionEdit.subject_name, questionEdit.topic_name].filter(Boolean).join(" · ") || "—"} — yalnızca bu konu güncellenir.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1">
            <Label htmlFor="admin-soru-sayisi">Soru sayısı</Label>
            <Input
              id="admin-soru-sayisi"
              inputMode="numeric"
              autoComplete="off"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              disabled={pending}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={pending}
              onClick={() => setQuestionEdit(null)}
            >
              Vazgeç
            </Button>
            <Button type="button" className="rounded-2xl" disabled={pending} onClick={saveQuestionCount}>
              {pending ? "…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
