"use client";

import { FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { getAdminSubmissionQuestionDownloadUrl } from "@/app/admin/actions";
import { getMyQuestionSubmissionQuestionUrl } from "@/app/student/actions";
import { getStudentQuestionSubmissionDownloadUrlForTeacher } from "@/app/teacher/actions";
import { cn } from "@/lib/utils";

type Variant = "teacher" | "student" | "admin";

type Props = {
  submissionId: string;
  variant: Variant;
  fileName: string;
  contentType: string | null;
  className?: string;
};

function isImageQuestion(mime: string | null, name: string): boolean {
  if (mime?.startsWith("image/")) return true;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ["jpg", "jpeg", "png", "webp"].includes(ext);
}

function isPdfQuestion(mime: string | null, name: string): boolean {
  if (mime === "application/pdf") return true;
  return name.toLowerCase().endsWith(".pdf");
}

async function fetchQuestionUrl(submissionId: string, variant: Variant) {
  switch (variant) {
    case "teacher":
      return getStudentQuestionSubmissionDownloadUrlForTeacher(submissionId);
    case "student":
      return getMyQuestionSubmissionQuestionUrl(submissionId);
    case "admin":
      return getAdminSubmissionQuestionDownloadUrl(submissionId);
    default:
      return { error: "Geçersiz" as const };
  }
}

/** Öğrencinin gönderdiği soru dosyası: görsel önizleme veya PDF/dosya satırı; tıklanınca tam boyut yeni sekmede açılır. */
export function QuestionSubmissionInline({
  submissionId,
  variant,
  fileName,
  contentType,
  className,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchQuestionUrl(submissionId, variant).then((res) => {
      if (cancelled) return;
      if (res.error) {
        setErr(res.error);
        setUrl(null);
      } else if (res.url) {
        setUrl(res.url);
        setErr(null);
      } else {
        setUrl(null);
        setErr(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [submissionId, variant]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 py-6 text-sm text-muted-foreground",
          className
        )}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Soru yükleniyor…
      </div>
    );
  }
  if (err) {
    return (
      <p className={cn("text-xs text-destructive", className)} role="alert">
        {err}
      </p>
    );
  }
  if (!url) return null;

  const img = isImageQuestion(contentType, fileName);
  const pdf = isPdfQuestion(contentType, fileName);

  if (img) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border/60 bg-muted/15",
          className
        )}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Signed URL — next/image domain yapılandırması gerekir */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Gönderilen soru"
            loading="lazy"
            className="max-h-80 w-full object-contain"
          />
        </a>
      </div>
    );
  }

  if (pdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <FileText className="size-8 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 text-left">
          <p className="font-medium text-foreground">PDF soru</p>
          <p className="truncate text-xs text-muted-foreground">{fileName}</p>
          <p className="text-[11px] text-primary">Tıkla — yeni sekmede aç</p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block truncate rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-primary underline-offset-2 hover:underline",
        className
      )}
    >
      {fileName}
    </a>
  );
}
