import { cn } from "@/lib/utils";

export type AppShellVariant = "student" | "teacher";

const shellStyles: Record<
  AppShellVariant,
  {
    gradient: string;
    radial: string;
    bottom: string;
  }
> = {
  student: {
    gradient:
      "bg-gradient-to-b from-emerald-50/90 via-background to-background dark:from-emerald-950/25 dark:via-background dark:to-background",
    radial:
      "bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(16,185,129,0.18),transparent_55%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(52,211,153,0.12),transparent_55%)]",
    bottom:
      "bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.04),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent_70%)]",
  },
  teacher: {
    gradient:
      "bg-gradient-to-b from-sky-50/90 via-background to-background dark:from-sky-950/22 dark:via-background dark:to-background",
    radial:
      "bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(14,165,233,0.16),transparent_55%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(56,189,248,0.1),transparent_55%)]",
    bottom:
      "bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.06),transparent_72%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.06),transparent_72%)]",
  },
};

/** Giriş sayfası ile uyumlu gradient arka plan katmanları */
export function AppBackground({ variant }: { variant: AppShellVariant }) {
  const s = shellStyles[variant];
  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          s.gradient
        )}
        aria-hidden
      />
      <div
        className={cn("pointer-events-none absolute inset-0", s.radial)}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute bottom-0 left-1/2 h-[min(50vh,420px)] w-[min(100%,720px)] -translate-x-1/2",
          s.bottom
        )}
        aria-hidden
      />
    </>
  );
}

type AppShellProps = {
  children: React.ReactNode;
  variant: AppShellVariant;
  className?: string;
};

export function AppShell({ children, variant, className }: AppShellProps) {
  return (
    <div className={cn("relative min-h-dvh w-full overflow-x-hidden", className)}>
      <AppBackground variant={variant} />
      <div className="relative z-10 flex min-h-dvh w-full flex-col">{children}</div>
    </div>
  );
}

/** Kart / hero blokları için giriş ekranıyla uyumlu cam + gölge */
export function appPanelClassName(extra?: string) {
  return cn(
    "rounded-[1.35rem] border border-border/60 bg-card/80 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.1)] backdrop-blur-sm",
    "dark:border-border/50 dark:bg-card/65 dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)]",
    extra
  );
}
