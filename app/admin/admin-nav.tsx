"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Öğrenci yönetimi" },
  { href: "/admin/istatistikler", label: "İstatistikler" },
];

export function AdminNav({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="border-b border-border/60 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Yönetici
          </p>
          <p className="truncate font-semibold text-foreground">
            Merhaba, {displayName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1" aria-label="Yönetici menü">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(l.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {l.label}
              </Link>
            ))}
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
