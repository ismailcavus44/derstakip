"use client";

import { ChevronDown, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { SubjectRow, TopicRow } from "@/app/curriculum/actions";
import { submitStudentQuestionSubmission } from "@/app/student/actions";
import {
  QUESTION_ISSUE_KIND_LABELS,
  type QuestionIssueKind,
} from "@/lib/question-issue-kind";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MAX_STUDENT_QUESTION_BYTES } from "@/lib/student-question-uploads";

/** Boşlukla ayrılmış her kelime, konu adında (Türkçe büyük/küçük duyarsız) geçmeli. */
function topicNameMatchesQuery(name: string, query: string): boolean {
  const raw = query.trim();
  if (!raw) return true;
  const lower = name.toLocaleLowerCase("tr-TR");
  const parts = raw.toLocaleLowerCase("tr-TR").split(/\s+/).filter(Boolean);
  return parts.every((p) => lower.includes(p));
}

type Props = {
  subjects: SubjectRow[];
  topics: TopicRow[];
};

export function StudentQuestionUploadButton({ subjects, topics }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [topicPopoverOpen, setTopicPopoverOpen] = useState(false);
  const [topicSearch, setTopicSearch] = useState("");
  const topicSearchInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [issueKind, setIssueKind] = useState<QuestionIssueKind>("could_not_solve");
  const [isPending, startTransition] = useTransition();

  const topicOptions = useMemo(() => {
    if (!subjectId) return [];
    return topics.filter((t) => t.subject_id === subjectId);
  }, [subjectId, topics]);

  /** Base UI Select: Value, etiket için Root’ta items gerekir; yoksa ham id görünür. */
  const subjectItems = useMemo(
    () => subjects.map((s) => ({ value: s.id, label: s.name })),
    [subjects]
  );

  const filteredTopicOptions = useMemo(
    () => topicOptions.filter((t) => topicNameMatchesQuery(t.name, topicSearch)),
    [topicOptions, topicSearch]
  );

  const selectedTopicLabel = useMemo(() => {
    if (!topicId) return null;
    return topicOptions.find((t) => t.id === topicId)?.name ?? null;
  }, [topicId, topicOptions]);

  const canOpen = subjects.length > 0 && topics.length > 0;

  useEffect(() => {
    if (topicPopoverOpen) {
      const t = window.setTimeout(() => topicSearchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [topicPopoverOpen]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSubjectId(null);
      setTopicId(null);
      setTopicSearch("");
      setTopicPopoverOpen(false);
      setError(null);
      setIssueKind("could_not_solve");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!topicId) {
      setError("Ders ve konu seç.");
      return;
    }
    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setError("Dosya seç.");
      return;
    }

    const fd = new FormData();
    fd.set("file", file);

    startTransition(async () => {
      const res = await submitStudentQuestionSubmission(topicId, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      handleOpenChange(false);
      form.reset();
      router.refresh();
      router.push("/student/sorularim");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        className="shrink-0 rounded-2xl"
        disabled={!canOpen}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Upload className="mr-2 size-4" aria-hidden />
        Soru yükle
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Soru yükle</DialogTitle>
            <DialogDescription>
              Ders ve konuyu seç; soruda nasıl takıldığını işaretle. JPEG, PNG, WebP veya
              PDF (en fazla {Math.round(MAX_STUDENT_QUESTION_BYTES / (1024 * 1024))} MB)
              yükleyebilirsin. Öğretmenin Sorular sayfasında ve bildirimlerde görünür.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sq-subject">Ders</Label>
              <Select
                value={subjectId ?? ""}
                onValueChange={(v) => {
                  setSubjectId(v || null);
                  setTopicId(null);
                  setTopicSearch("");
                  setTopicPopoverOpen(false);
                }}
                items={subjectItems}
                disabled={isPending}
              >
                <SelectTrigger
                  id="sq-subject"
                  className="w-full min-w-0 rounded-xl"
                >
                  <SelectValue placeholder="Ders seç" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sq-topic-search">Konu</Label>
              <Popover
                open={topicPopoverOpen}
                onOpenChange={(o) => {
                  setTopicPopoverOpen(o);
                  if (!o) setTopicSearch("");
                }}
              >
                <PopoverTrigger
                  id="sq-topic"
                  type="button"
                  disabled={
                    isPending || !subjectId || topicOptions.length === 0
                  }
                  className={cn(
                    "flex h-8 w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm outline-none transition-colors",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                    "dark:bg-input/30",
                    !selectedTopicLabel && "text-muted-foreground"
                  )}
                >
                  <span className="line-clamp-1 flex-1">
                    {!subjectId
                      ? "Önce ders seç"
                      : topicOptions.length === 0
                        ? "Bu derste konu yok"
                        : selectedTopicLabel ?? "Konu seç — yazarak ara"}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[min(calc(100vw-2rem),22rem)] p-2"
                  sideOffset={4}
                >
                  <Input
                    ref={topicSearchInputRef}
                    id="sq-topic-search"
                    type="search"
                    value={topicSearch}
                    onChange={(e) => setTopicSearch(e.target.value)}
                    placeholder="Konuda ara (kelimelerle filtrele)…"
                    autoComplete="off"
                    className="mb-2 rounded-lg"
                    disabled={isPending}
                  />
                  <div
                    className="max-h-[min(50vh,16rem)] overflow-y-auto rounded-md border border-border/60"
                    role="listbox"
                    aria-label="Konu listesi"
                  >
                    {filteredTopicOptions.length === 0 ? (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                        {topicSearch.trim()
                          ? "Eşleşen konu yok."
                          : "Konu yok."}
                      </p>
                    ) : (
                      <ul className="p-1">
                        {filteredTopicOptions.map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={topicId === t.id}
                              className={cn(
                                "flex w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                "hover:bg-accent hover:text-accent-foreground",
                                topicId === t.id &&
                                  "bg-accent/80 font-medium text-accent-foreground"
                              )}
                              onClick={() => {
                                setTopicId(t.id);
                                setTopicPopoverOpen(false);
                                setTopicSearch("");
                              }}
                            >
                              {t.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                Bu soruda durumun
              </legend>
              <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
                {(
                  [
                    "could_not_solve",
                    "wrong_answer",
                  ] as const satisfies readonly QuestionIssueKind[]
                ).map((k) => (
                  <label
                    key={k}
                    className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug"
                  >
                    <input
                      type="radio"
                      name="sq-issue-kind"
                      value={k}
                      checked={issueKind === k}
                      onChange={() => setIssueKind(k)}
                      disabled={isPending}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span>{QUESTION_ISSUE_KIND_LABELS[k]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="sq-file">Dosya</Label>
              <input
                id="sq-file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary-foreground"
                disabled={isPending}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={isPending}
                onClick={() => handleOpenChange(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                className="rounded-xl"
                disabled={isPending || !topicId}
              >
                {isPending ? "Gönderiliyor…" : "Gönder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
