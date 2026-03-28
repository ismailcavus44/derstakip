import type { Metadata } from "next";

import { ElifimHeart } from "@/app/elifim-beni-affet-lan/elifim-heart";
import { ElifimPoem } from "@/app/elifim-beni-affet-lan/elifim-poem";

export const metadata: Metadata = {
  title: "Elifim beni affet lan",
  robots: { index: false, follow: false },
};

export default function ElifimBeniAffetLanPage() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-50/90 via-background to-background dark:from-emerald-950/25 dark:via-background dark:to-background"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(16,185,129,0.18),transparent_55%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(52,211,153,0.12),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[min(50vh,420px)] w-[min(100%,720px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.04),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent_70%)]"
        aria-hidden
      />

      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 px-3 py-8 text-center sm:gap-8 sm:px-5 sm:py-12">
        <ElifimHeart />

        <ElifimPoem />
      </main>
    </div>
  );
}
