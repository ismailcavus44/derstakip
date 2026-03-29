"use client";

import { useTransition } from "react";

import { getAdminSubmissionAnswerDownloadUrl } from "@/app/admin/actions";
import { getMyQuestionSubmissionAnswerUrl } from "@/app/student/actions";
import { getStudentQuestionSubmissionAnswerDownloadUrlForTeacher } from "@/app/teacher/actions";
import { cn } from "@/lib/utils";

type Variant = "teacher" | "student" | "admin";

type Props = {
  submissionId: string;
  variant: Variant;
  /** Veritabanındaki cevap dosya adı (ör. cevap.jpg) */
  fileName: string;
  className?: string;
};

async function fetchAnswerUrl(submissionId: string, variant: Variant) {
  switch (variant) {
    case "teacher":
      return getStudentQuestionSubmissionAnswerDownloadUrlForTeacher(
        submissionId
      );
    case "student":
      return getMyQuestionSubmissionAnswerUrl(submissionId);
    case "admin":
      return getAdminSubmissionAnswerDownloadUrl(submissionId);
    default:
      return { error: "Geçersiz" as const };
  }
}

/** Cevap dosyası yalnızca ad olarak; tıklanınca imzalı URL ile yeni sekmede açılır. */
export function AnswerFileLink({
  submissionId,
  variant,
  fileName,
  className,
}: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const res = await fetchAnswerUrl(submissionId, variant);
          if (res.error) {
            window.alert(res.error);
            return;
          }
          if (res.url) {
            window.open(res.url, "_blank", "noopener,noreferrer");
          }
        });
      }}
      className={cn(
        "max-w-full truncate text-left text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50",
        className
      )}
    >
      {isPending ? "Açılıyor…" : fileName}
    </button>
  );
}
