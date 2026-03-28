"use client";

import { BarChart3, GraduationCap, LayoutDashboard, ListTodo } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  {
    href: "/teacher",
    label: "Özet",
    icon: LayoutDashboard,
  },
  {
    href: "/teacher/tasks",
    label: "Görevler",
    icon: ListTodo,
  },
  {
    href: "/teacher/ilerleme",
    label: "İlerleme",
    icon: BarChart3,
  },
] as const;

export function TeacherNav({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/teacher"
      ? pathname === "/teacher" || pathname === "/teacher/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="sticky top-0 z-20 border-b border-white/20 bg-white/25 shadow-none backdrop-blur-xl supports-[backdrop-filter]:bg-white/15 dark:border-white/10 dark:bg-black/15 dark:supports-[backdrop-filter]:bg-black/10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/95 text-primary-foreground shadow-sm ring-2 ring-primary/20 backdrop-blur-sm">
            <GraduationCap className="size-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Öğretmen
            </p>
            <p className="truncate text-base font-semibold text-foreground">
              {displayName}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1" aria-label="Öğretmen menü">
            {links.map((l) => {
              const Icon = l.icon;
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="rounded-full">
              Çıkış
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
