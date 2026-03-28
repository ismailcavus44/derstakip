"use client";

import { BarChart3, Bell, ClipboardList, LayoutDashboard, ListChecks } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markNotificationRead, type TeacherNotificationRow } from "@/app/teacher/actions";
import { appPanelClassName } from "@/components/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  notifications: TeacherNotificationRow[];
  teacherName: string;
  activeCount: number;
  completedCount: number;
};

export function TeacherDashboard({
  notifications,
  teacherName,
  activeCount,
  completedCount,
}: Props) {
  const router = useRouter();
  const [notifPendingId, setNotifPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function markRead(id: string) {
    setNotifPendingId(id);
    startTransition(async () => {
      await markNotificationRead(id);
      setNotifPendingId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 flex-col gap-6 px-5 pb-10 pt-4">
        <div className="flex justify-end">
          <Popover>
            <PopoverTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "icon" }),
                "relative size-11 rounded-full"
              )}
              aria-label="Bildirimler"
            >
              <Bell className="size-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(100vw-2rem,22rem)] max-h-[min(70vh,24rem)] overflow-hidden rounded-2xl p-0"
            >
              <div className="border-b border-border/60 px-4 py-3">
                <p className="text-sm font-semibold">Bildirimler</p>
                <p className="text-xs text-muted-foreground">
                  Öğrenciler görev tamamladığında burada görünür.
                </p>
              </div>
              <div className="max-h-[min(60vh,20rem)] overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Henüz bildirim yok.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        className={cn(
                          "px-4 py-3",
                          !n.read_at && "bg-muted/50"
                        )}
                      >
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            !n.read_at && "font-medium"
                          )}
                        >
                          {n.message}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(n.created_at)}
                        </p>
                        {!n.read_at && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-2 h-8 rounded-full text-xs"
                            disabled={notifPendingId === n.id || isPending}
                            onClick={() => markRead(n.id)}
                          >
                            {notifPendingId === n.id ? "…" : "Okundu işaretle"}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <section
          className={cn(
            appPanelClassName(
              "border-sky-200/50 bg-gradient-to-br from-sky-50/85 via-card/90 to-card/80 dark:border-sky-900/40 dark:from-sky-950/35 dark:via-card/80 dark:to-card/70"
            ),
            "p-6"
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md ring-4 ring-primary/15">
              <LayoutDashboard className="size-6" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Merhaba, {teacherName}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Görevleri oluşturup düzenlemek için{" "}
                <Link
                  href="/teacher/tasks"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Görevler
                </Link>
                ; öğrencilerinizin konu ve soru ilerlemesi için{" "}
                <Link
                  href="/teacher/ilerleme"
                  className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                >
                  <BarChart3 className="size-3.5 shrink-0" aria-hidden />
                  İlerleme
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Card
            className={cn(
              appPanelClassName("rounded-3xl border-sky-200/40 dark:border-sky-900/35"),
              "overflow-hidden"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Aktif görevler
                </p>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300">
                  <ClipboardList className="size-[18px]" aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {activeCount}
              </p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              appPanelClassName("rounded-3xl border-sky-200/40 dark:border-sky-900/35"),
              "overflow-hidden"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tamamlananlar
                </p>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/20 dark:text-emerald-200">
                  <ListChecks className="size-[18px]" aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums text-muted-foreground">
                {completedCount}
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
