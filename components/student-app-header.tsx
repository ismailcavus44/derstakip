"use client";

import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CalendarRange,
  FileQuestion,
  House,
  Menu,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type StudentNavActive = "tasks" | "ilerleme" | "program" | "sorularim";

const navBtn =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const navIdle =
  "border border-border/50 bg-muted/25 text-foreground hover:bg-muted/45 dark:border-border/40 dark:bg-muted/15 dark:hover:bg-muted/30";

const navActive =
  "border border-neutral-800 bg-neutral-950 text-white shadow-sm hover:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:bg-neutral-800";

function NavLink({
  href,
  active,
  children,
  icon,
  onNavigate,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  icon: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(navBtn, active ? navActive : navIdle)}
    >
      <span className="shrink-0 opacity-90 [&_svg]:size-[1.05rem]">{icon}</span>
      {children}
    </Link>
  );
}

export function StudentAppHeader({
  displayName,
  active,
}: {
  displayName: string;
  active: StudentNavActive;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  const logoutBtnClass =
    "h-10 min-h-10 rounded-xl border-border/50 bg-muted/25 px-5 text-sm font-semibold hover:bg-muted/45 dark:border-border/40 dark:bg-muted/15 dark:hover:bg-muted/30";

  const navItems = (
    <>
      <NavLink
        href="/student"
        active={active === "tasks"}
        onNavigate={closeMenu}
        icon={<House aria-hidden />}
      >
        Ana sayfa
      </NavLink>
      <NavLink
        href="/student/ilerleme"
        active={active === "ilerleme"}
        onNavigate={closeMenu}
        icon={<TrendingUp aria-hidden />}
      >
        İlerleme
      </NavLink>
      <NavLink
        href="/student/ders-programi"
        active={active === "program"}
        onNavigate={closeMenu}
        icon={<CalendarRange aria-hidden />}
      >
        Ders programı
      </NavLink>
      <NavLink
        href="/student/sorularim"
        active={active === "sorularim"}
        onNavigate={closeMenu}
        icon={<FileQuestion aria-hidden />}
      >
        Sorularım
      </NavLink>
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-transparent dark:border-border/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4">
        <Link
          href="/student"
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-0.5 pr-2 outline-none transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring sm:gap-3.5"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 sm:size-12">
            <BookOpen
              className="size-[1.25rem] sm:size-[1.35rem]"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Öğrenci paneli
            </p>
            <p className="truncate text-sm font-bold tracking-tight text-foreground sm:text-base">
              {displayName}
            </p>
          </div>
        </Link>

        <nav
          className="hidden items-center gap-2.5 md:flex"
          aria-label="Öğrenci menüsü"
        >
          {navItems}
          <form action={logoutAction} className="ml-1 shrink-0">
            <Button
              type="submit"
              variant="outline"
              className={logoutBtnClass}
            >
              Çıkış
            </Button>
          </form>
        </nav>

        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="rounded-xl border-border/50 bg-muted/25 shadow-none hover:bg-muted/45 dark:border-border/40 dark:bg-muted/15 dark:hover:bg-muted/30"
            aria-expanded={menuOpen}
            aria-controls="student-mobile-menu"
            aria-label="Menüyü aç"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" strokeWidth={2} aria-hidden />
          </Button>
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogContent
              id="student-mobile-menu"
              showCloseButton
              className={cn(
                "fixed inset-y-0 right-0 left-auto top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-[min(100vw-0.5rem,20rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none rounded-l-3xl border-y-0 border-r-0 border-l p-0 shadow-2xl sm:max-w-none"
              )}
            >
              <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 text-left">
                <DialogTitle className="text-base font-bold">Menü</DialogTitle>
                <p className="text-sm text-muted-foreground">{displayName}</p>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <div className="flex flex-col gap-2 px-4 py-4">
                  <NavLink
                    href="/student"
                    active={active === "tasks"}
                    onNavigate={closeMenu}
                    icon={<House aria-hidden />}
                  >
                    Ana sayfa
                  </NavLink>
                  <NavLink
                    href="/student/ilerleme"
                    active={active === "ilerleme"}
                    onNavigate={closeMenu}
                    icon={<TrendingUp aria-hidden />}
                  >
                    İlerleme
                  </NavLink>
                  <NavLink
                    href="/student/ders-programi"
                    active={active === "program"}
                    onNavigate={closeMenu}
                    icon={<CalendarRange aria-hidden />}
                  >
                    Ders programı
                  </NavLink>
                  <NavLink
                    href="/student/sorularim"
                    active={active === "sorularim"}
                    onNavigate={closeMenu}
                    icon={<FileQuestion aria-hidden />}
                  >
                    Sorularım
                  </NavLink>
                </div>
                <div className="mt-auto border-t border-border/60 p-4">
                  <form action={logoutAction} className="w-full">
                    <Button
                      type="submit"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-border/50 bg-muted/25 text-sm font-semibold hover:bg-muted/45 dark:border-border/40 dark:bg-muted/15 dark:hover:bg-muted/30"
                    >
                      Çıkış yap
                    </Button>
                  </form>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
