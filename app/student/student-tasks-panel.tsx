"use client";

import { CheckCircle2, Circle, MoreVertical } from "lucide-react";
import { useState, useTransition } from "react";

import { completeTask } from "@/app/student/actions";
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
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type StudentTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "completed";
  created_at: string;
  task_kind: "soru_cozumu" | "konu_anlatimi" | null;
  question_count: number | null;
  followup_question_count: number | null;
  subject_name: string | null;
  topic_name: string | null;
};

type Props = {
  tasks: StudentTaskRow[];
};

function taskMetaLine(task: StudentTaskRow) {
  const parts: string[] = [];
  if (task.subject_name) parts.push(task.subject_name);
  if (task.topic_name) parts.push(task.topic_name);
  if (task.task_kind === "konu_anlatimi") {
    parts.push("Konu anlatımı");
  } else if (task.task_kind === "soru_cozumu") {
    parts.push("Soru çözümü");
  }
  return parts.length ? parts.join(" · ") : null;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function StudentTasksPanel({ tasks }: Props) {
  const [detailTask, setDetailTask] = useState<StudentTaskRow | null>(null);
  const [confirmTask, setConfirmTask] = useState<StudentTaskRow | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const detailMeta = detailTask ? taskMetaLine(detailTask) : null;

  const pending = tasks.filter((t) => t.status === "pending");
  const completed = tasks.filter((t) => t.status === "completed");

  function openConfirmFromCard(task: StudentTaskRow) {
    setConfirmTask(task);
    setConfirmError(null);
  }

  function handleConfirmComplete() {
    if (!confirmTask) return;
    setConfirmError(null);
    startTransition(async () => {
      const res = await completeTask(confirmTask.id);
      if (res?.error) {
        setConfirmError(res.error);
        return;
      }
      setConfirmTask(null);
    });
  }

  if (tasks.length === 0) {
    return (
      <Card className="rounded-3xl border-dashed border-border/80 bg-muted/30">
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Henüz atanmış görev yok.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Öğretmenin görev eklediğinde burada görünecek.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {pending.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Bekleyen ({pending.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {pending.map((task) => {
                const meta = taskMetaLine(task);
                return (
                  <li key={task.id}>
                    <div className="flex w-full items-start gap-1 rounded-2xl border border-border/50 bg-card/70 p-3.5 pr-2 backdrop-blur-sm transition hover:border-border/70 hover:bg-card/90 sm:items-start sm:gap-2 sm:p-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
                          <Circle
                            className="size-5"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0 flex-1 pb-0.5">
                          <p className="font-semibold leading-snug text-foreground">
                            {task.title}
                          </p>
                          {meta && (
                            <p className="mt-0.5 text-xs font-medium text-primary">
                              {meta}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground/80">
                            {formatDate(task.created_at)}
                          </p>
                          {task.task_kind === "konu_anlatimi" &&
                            (task.followup_question_count ?? 20) > 0 && (
                              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                                Konu sonrası {task.followup_question_count ?? 20}{" "}
                                soru
                              </p>
                            )}
                          {task.task_kind === "soru_cozumu" &&
                            task.question_count != null && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {task.question_count} soru
                              </p>
                            )}
                          {task.description?.trim() && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Popover>
                        <PopoverTrigger
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                            "size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                          )}
                          aria-label="Görev seçenekleri"
                        >
                          <MoreVertical className="size-5" strokeWidth={2} />
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-48 p-1">
                          <button
                            type="button"
                            className="flex w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => setDetailTask(task)}
                          >
                            Detaylar
                          </button>
                          <button
                            type="button"
                            className="flex w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => openConfirmFromCard(task)}
                            disabled={isPending}
                          >
                            Görevi tamamla
                          </button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {completed.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tamamlanan ({completed.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {completed.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => setDetailTask(task)}
                    className="flex w-full items-start gap-3 rounded-2xl border border-border/50 bg-card/60 p-3.5 text-left opacity-80 backdrop-blur-sm transition hover:border-border/70 hover:bg-card/90 hover:opacity-100 sm:p-4"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
                      <CheckCircle2 className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-muted-foreground line-through decoration-muted-foreground/60">
                        {task.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground/80">
                        {formatDate(task.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Dialog open={!!detailTask} onOpenChange={(o) => !o && setDetailTask(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {detailTask?.title}
            </DialogTitle>
            {detailMeta && (
              <p className="text-xs font-medium text-primary">{detailMeta}</p>
            )}
            <DialogDescription className="text-xs">
              {detailTask ? formatDate(detailTask.created_at) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Durum: </span>
              {detailTask?.status === "completed" ? "Tamamlandı" : "Bekliyor"}
            </p>
            {detailTask?.task_kind === "konu_anlatimi" &&
              (detailTask.followup_question_count ?? 20) > 0 && (
                <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-900 dark:text-emerald-100">
                  Konu sonrası{" "}
                  <span className="font-semibold">
                    {detailTask.followup_question_count ?? 20}
                  </span>{" "}
                  soru çözümü
                </p>
              )}
            {detailTask?.task_kind === "soru_cozumu" &&
              detailTask.question_count != null && (
                <p>
                  <span className="font-medium text-foreground">
                    Soru sayısı:{" "}
                  </span>
                  {detailTask.question_count}
                </p>
              )}
            <p className="whitespace-pre-wrap">
              {detailTask?.description?.trim()
                ? detailTask.description
                : "Açıklama yok."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmTask}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmTask(null);
            setConfirmError(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Görevi tamamla?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{confirmTask?.title}&quot; görevini tamamlandı olarak
              işaretlemek istediğine emin misin? Öğretmenin bildirim alacak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmError && (
            <p className="text-sm text-destructive">{confirmError}</p>
          )}
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel
              className="rounded-2xl"
              disabled={isPending}
              onClick={() => setConfirmError(null)}
            >
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl"
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmComplete();
              }}
            >
              {isPending ? "Kaydediliyor…" : "Evet, tamamla"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
