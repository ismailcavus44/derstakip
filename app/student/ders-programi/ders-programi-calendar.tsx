"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { completeTask } from "@/app/student/actions";
import {
  createScheduleEntry,
  deleteScheduleEntry,
} from "@/app/student/schedule-actions";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADERS = [
  "Paz",
  "Pzt",
  "Sal",
  "Çar",
  "Per",
  "Cum",
  "Cmt",
] as const;

const SNAP_MINUTES = 15;

export type ScheduleTaskOption = {
  id: string;
  title: string;
  status: string;
};

export type ScheduleEntryVM = {
  id: string;
  task_id: string;
  scheduled_date: string;
  start_minutes: number;
  end_minutes: number;
  task_title: string;
  task_status: string;
  task_description: string | null;
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function minutesToLabel(m: number) {
  const clamped = Math.max(0, Math.min(1439, Math.floor(m)));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function minutesToTimeInput(m: number) {
  const clamped = Math.max(0, Math.min(1439, Math.floor(m)));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseTimeInput(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (
    !Number.isFinite(h) ||
    !Number.isFinite(min) ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59
  ) {
    return null;
  }
  return h * 60 + min;
}

function monthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

function buildMonthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startPad = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= lastDay; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

type Props = {
  tasks: ScheduleTaskOption[];
  entries: ScheduleEntryVM[];
  migrationHint?: string | null;
};

export function DersProgramiCalendar({
  tasks,
  entries,
  migrationHint,
}: Props) {
  const router = useRouter();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [addOpen, setAddOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [startMinutes, setStartMinutes] = useState(540);
  const [endMinutes, setEndMinutes] = useState(600);
  const [formError, setFormError] = useState<string | null>(null);

  const [detailEntry, setDetailEntry] = useState<ScheduleEntryVM | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState("");

  const [pending, startTransition] = useTransition();

  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const entriesByDate = useMemo(() => {
    const m: Record<string, ScheduleEntryVM[]> = {};
    for (const e of entries) {
      const k = e.scheduled_date;
      if (!m[k]) m[k] = [];
      m[k].push(e);
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => a.start_minutes - b.start_minutes);
    }
    return m;
  }, [entries]);

  const taskItems = useMemo(
    () =>
      tasks.map((t) => ({
        value: t.id,
        label:
          t.status === "completed"
            ? `${t.title} (tamamlandı)`
            : t.title,
      })),
    [tasks]
  );

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function openAddForDate(iso: string) {
    setPickedDate(iso);
    setTaskId(tasks[0]?.id ?? null);
    setStartMinutes(540);
    setEndMinutes(600);
    setFormError(null);
    setAddOpen(true);
  }

  function openDetail(en: ScheduleEntryVM) {
    setDetailError(null);
    setDetailEntry(en);
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickedDate || !taskId) {
      setFormError("Görev seçin.");
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const res = await createScheduleEntry({
        taskId,
        scheduledDate: pickedDate,
        startMinutes,
        endMinutes,
      });
      if (res.error) {
        setFormError(res.error);
        return;
      }
      setAddOpen(false);
    });
  }

  function handleCompleteFromDetail() {
    if (!detailEntry || detailEntry.task_status !== "pending") return;
    setDetailError(null);
    startTransition(async () => {
      const res = await completeTask(detailEntry.task_id);
      if (res.error) {
        setDetailError(res.error);
        return;
      }
      setDetailEntry(null);
      router.refresh();
    });
  }

  function requestDeleteFromDetail() {
    if (!detailEntry) return;
    setDeleteId(detailEntry.id);
    setDeleteTitle(detailEntry.task_title);
    setDetailEntry(null);
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      await deleteScheduleEntry(id);
    });
  }

  const todayIso = toIsoDate(new Date());

  return (
    <>
      {migrationHint && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-950 sm:text-sm dark:text-amber-100">
          {migrationHint}
        </p>
      )}

      <div className="flex w-full min-w-0 flex-col gap-3 sm:gap-4">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-10 shrink-0 touch-manipulation rounded-full sm:h-9 sm:w-9"
            onClick={() => shiftMonth(-1)}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="size-5 sm:size-4" />
          </Button>
          <h2 className="min-w-0 flex-1 px-1 text-center text-sm font-semibold capitalize leading-tight text-foreground sm:text-base md:text-lg">
            {monthTitle(viewYear, viewMonth)}
          </h2>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-10 shrink-0 touch-manipulation rounded-full sm:h-9 sm:w-9"
            onClick={() => shiftMonth(1)}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="size-5 sm:size-4" />
          </Button>
        </div>

        <div className="-mx-3 overflow-x-auto overscroll-x-contain px-3 touch-pan-x sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="min-w-[300px] overflow-hidden rounded-lg border border-border/50 bg-card/30 sm:min-w-[320px] sm:rounded-xl">
            <div className="grid grid-cols-7 border-b border-border/50 bg-transparent">
              {WEEKDAY_HEADERS.map((h) => (
                <div
                  key={h}
                  className="min-w-0 border-l border-border/40 px-0.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground first:border-l-0 sm:px-0 sm:py-2 sm:text-[11px]"
                >
                  {h}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date, idx) => {
                if (!date) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[76px] border-b border-l border-border/35 bg-transparent first:border-l-0 sm:min-h-[88px] md:min-h-[96px]"
                    />
                  );
                }
                const iso = toIsoDate(date);
                const dayEntries = entriesByDate[iso] ?? [];
                const isToday = iso === todayIso;

                return (
                  <div
                    key={iso}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        openAddForDate(iso);
                      }
                    }}
                    className={cn(
                      "flex min-h-[76px] cursor-pointer touch-manipulation flex-col border-b border-l border-border/35 px-0 pt-0 first:border-l-0 sm:min-h-[88px] md:min-h-[96px]",
                      isToday &&
                        "relative z-[1] bg-blue-500/[0.06] ring-2 ring-inset ring-blue-500/55 dark:bg-blue-400/[0.08] dark:ring-blue-400/50"
                    )}
                    onClick={() => openAddForDate(iso)}
                  >
                    <div
                      className={cn(
                        "mb-0.5 shrink-0 px-1.5 pt-1 text-right text-[10px] font-medium tabular-nums text-muted-foreground sm:mb-1 sm:px-2 sm:pt-1.5 sm:text-[11px]",
                        isToday && "font-semibold text-primary"
                      )}
                    >
                      {date.getDate()}
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 px-1.5 pb-1.5 sm:gap-1 sm:px-2 sm:pb-2">
                      {dayEntries.map((en) => (
                        <button
                          key={en.id}
                          type="button"
                          className={cn(
                            "min-h-[40px] w-full min-w-0 max-w-full shrink-0 rounded-md border border-border/50 bg-muted/35 px-1 py-1 text-left shadow-sm transition-colors sm:min-h-0 sm:px-1.5",
                            "hover:border-primary/40 hover:bg-primary/10 active:bg-primary/15"
                          )}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openDetail(en);
                          }}
                        >
                          <span
                            className="block w-full truncate text-center text-[9px] font-medium leading-tight text-foreground sm:text-[10px] md:text-[11px]"
                            title={en.task_title}
                          >
                            {en.task_title}
                          </span>
                          <span className="block w-full truncate text-center text-[8px] text-muted-foreground tabular-nums sm:text-[9px]">
                            {minutesToLabel(en.start_minutes)} –{" "}
                            {minutesToLabel(en.end_minutes)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
        Boş güne dokunarak görev ve saat aralığı ekleyin. Kutuya dokununca detay
        ve tamamlama açılır.
      </p>

      {/* Ekle */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          showCloseButton
          className={cn(
            "flex max-h-[min(92dvh,32rem)] w-[min(100vw-1rem,26rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md sm:rounded-3xl"
          )}
        >
          <form
            onSubmit={handleAddSubmit}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-3 pr-11 pt-4 sm:px-5 sm:pr-12 sm:pt-5">
              <DialogHeader className="min-w-0 gap-2 text-left">
                <DialogTitle className="break-words pr-1 text-base leading-snug">
                  Görev ekle
                </DialogTitle>
                <DialogDescription className="break-words text-left">
                  {pickedDate &&
                    new Intl.DateTimeFormat("tr-TR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(pickedDate + "T12:00:00"))}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid min-w-0 gap-3">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="cal-task">Görev</Label>
                  <Select
                    value={taskId}
                    onValueChange={(v) => setTaskId(v ?? null)}
                    items={taskItems}
                    disabled={tasks.length === 0}
                  >
                    <SelectTrigger
                      id="cal-task"
                      className="h-auto min-h-8 w-full min-w-0 max-w-full rounded-2xl py-2 [&_[data-slot=select-value]]:line-clamp-2 [&_[data-slot=select-value]]:whitespace-normal"
                    >
                      <SelectValue placeholder="Görev seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {tasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.status === "completed"
                            ? `${t.title} (tamamlandı)`
                            : t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {tasks.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Henüz atanmış görev yok.
                    </p>
                  )}
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="cal-start">Başlangıç</Label>
                    <Input
                      id="cal-start"
                      type="time"
                      step={60 * SNAP_MINUTES}
                      value={minutesToTimeInput(startMinutes)}
                      onChange={(ev) => {
                        const m = parseTimeInput(ev.target.value);
                        if (m != null) setStartMinutes(m);
                      }}
                      className="min-w-0 rounded-2xl"
                      required
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="cal-end">Bitiş</Label>
                    <Input
                      id="cal-end"
                      type="time"
                      step={60 * SNAP_MINUTES}
                      value={minutesToTimeInput(endMinutes)}
                      onChange={(ev) => {
                        const m = parseTimeInput(ev.target.value);
                        if (m != null) setEndMinutes(m);
                      }}
                      className="min-w-0 rounded-2xl"
                      required
                    />
                  </div>
                </div>
                {formError && (
                  <p
                    className="break-words text-sm font-medium text-destructive"
                    role="alert"
                  >
                    {formError}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/60 bg-muted/40 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5 sm:py-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11 w-full rounded-full touch-manipulation sm:h-9 sm:min-h-0 sm:w-auto"
                onClick={() => setAddOpen(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                className="h-11 min-h-11 w-full rounded-full touch-manipulation sm:h-9 sm:min-h-0 sm:w-auto"
                disabled={pending || tasks.length === 0}
              >
                {pending ? "Kaydediliyor…" : "Ekle"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detay */}
      <Dialog
        open={!!detailEntry}
        onOpenChange={(o) => {
          if (!o) {
            setDetailEntry(null);
            setDetailError(null);
          }
        }}
      >
        <DialogContent
          showCloseButton
          className={cn(
            "flex max-h-[min(92dvh,30rem)] w-[min(100vw-1rem,24rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md sm:rounded-3xl"
          )}
        >
          {detailEntry && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-3 pr-11 pt-4 sm:px-5 sm:pr-12 sm:pt-5">
                <DialogHeader className="min-w-0 gap-2 text-left">
                  <DialogTitle className="break-words text-base leading-snug">
                    {detailEntry.task_title}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Görev detayı ve saat aralığı
                  </DialogDescription>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>
                      {new Intl.DateTimeFormat("tr-TR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(
                        new Date(detailEntry.scheduled_date + "T12:00:00")
                      )}
                    </p>
                    <p className="font-medium text-foreground">
                      Saat: {minutesToLabel(detailEntry.start_minutes)} –{" "}
                      {minutesToLabel(detailEntry.end_minutes)}
                    </p>
                    {detailEntry.task_description?.trim() && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {detailEntry.task_description}
                      </p>
                    )}
                    <p className="text-xs">
                      Durum:{" "}
                      {detailEntry.task_status === "completed"
                        ? "Tamamlandı"
                        : "Bekliyor"}
                    </p>
                  </div>
                </DialogHeader>
                {detailError && (
                  <p
                    className="mt-3 break-words text-sm font-medium text-destructive"
                    role="alert"
                  >
                    {detailError}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 bg-muted/40 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:justify-end sm:px-5 sm:py-4">
                {detailEntry.task_status === "pending" && (
                  <Button
                    type="button"
                    className="h-11 min-h-11 w-full rounded-full touch-manipulation sm:h-9 sm:min-h-0 sm:w-auto"
                    disabled={pending}
                    onClick={handleCompleteFromDetail}
                  >
                    {pending ? "…" : "Görevi tamamla"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 min-h-11 w-full rounded-full touch-manipulation sm:h-9 sm:min-h-0 sm:w-auto"
                  disabled={pending}
                  onClick={requestDeleteFromDetail}
                >
                  Programdan kaldır
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-h-11 w-full rounded-full touch-manipulation sm:h-9 sm:min-h-0 sm:w-auto"
                  onClick={() => setDetailEntry(null)}
                >
                  Kapat
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] rounded-2xl sm:rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Programdan kaldır?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTitle}&quot; bu günden çıkarılacak. Görevin kendisi
              silinmez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
