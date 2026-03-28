"use client";

import { addStudentTopicQuestionsDelta } from "@/app/student/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { videoCurriculumBySlug } from "@/lib/video-curriculum";
import { cn } from "@/lib/utils";
import { ChevronUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type SubjectItem = {
  id: string;
  name: string;
  sort_order: number;
  slug?: string;
};

type TopicItem = {
  id: string;
  name: string;
  sort_order: number;
  subject_id: string;
};

type Props = {
  subjects: SubjectItem[];
  topics: TopicItem[];
};

const QUICK = [10, 20, 30, 40] as const;

export function StudentAddQuestionsForm({ subjects, topics }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [anaKonu, setAnaKonu] = useState<string | null>(null);
  /** Tarih/Coğrafya: alt başlık metni (topics.name ile eşleşir) */
  const [videoAltLabel, setVideoAltLabel] = useState<string | null>(null);
  const [flatTopicId, setFlatTopicId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [expanded, setExpanded] = useState(false);

  const subjectSlug = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.slug,
    [subjects, subjectId]
  );

  const videoCurriculum = useMemo(
    () => videoCurriculumBySlug(subjectSlug),
    [subjectSlug]
  );

  const altKonular = useMemo(() => {
    if (!videoCurriculum || !anaKonu) return [];
    return (
      videoCurriculum.find((g) => g.anaKonu === anaKonu)?.altKonular ?? []
    );
  }, [videoCurriculum, anaKonu]);

  const resolvedTopicId = useMemo(() => {
    if (!subjectId) return null;
    if (videoCurriculum) {
      if (!videoAltLabel) return null;
      return (
        topics.find(
          (t) => t.subject_id === subjectId && t.name === videoAltLabel
        )?.id ?? null
      );
    }
    return flatTopicId;
  }, [
    subjectId,
    videoCurriculum,
    videoAltLabel,
    flatTopicId,
    topics,
  ]);

  const topicsForSubject = useMemo(() => {
    if (!subjectId) return [];
    return topics
      .filter((t) => t.subject_id === subjectId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [topics, subjectId]);

  function runAdd(delta: number) {
    setError(null);
    if (!resolvedTopicId) {
      setError("Ders ve konuyu eksiksiz seçin.");
      return;
    }
    startTransition(async () => {
      const res = await addStudentTopicQuestionsDelta(resolvedTopicId, delta);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(customAmount.replace(/\s/g, ""), 10);
    if (!Number.isFinite(n) || n < 1) {
      setError("1 veya daha büyük bir tam sayı girin.");
      return;
    }
    runAdd(n);
    setCustomAmount("");
  }

  const canAdd = Boolean(resolvedTopicId) && !pending;
  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.sort_order - b.sort_order),
    [subjects]
  );

  const fieldTriggerClass =
    "h-11 w-full min-w-0 rounded-2xl border-emerald-200/70 bg-background shadow-none transition-colors hover:border-emerald-300/80 focus-visible:border-emerald-500 dark:border-emerald-800/50 dark:bg-background dark:hover:border-emerald-700/80";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-emerald-200/50 bg-card text-card-foreground shadow-[0_2px_24px_-4px_rgba(15,23,42,0.07)]",
        "dark:border-emerald-900/40 dark:bg-card dark:shadow-[0_2px_32px_-6px_rgba(0,0,0,0.45)]"
      )}
      aria-labelledby="student-add-q-heading"
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4",
          "border-b border-emerald-500/10 bg-gradient-to-r from-emerald-50/80 via-card to-card dark:from-emerald-950/30 dark:via-card"
        )}
      >
        <button
          type="button"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md",
            "ring-2 ring-emerald-500/20 transition-transform hover:bg-emerald-700 hover:ring-emerald-500/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "dark:bg-emerald-600 dark:ring-emerald-400/15 dark:hover:bg-emerald-500",
            "mt-0.5 self-center"
          )}
          aria-expanded={expanded}
          aria-controls="student-add-q-panel"
          aria-label={expanded ? "Soru ekle formunu kapat" : "Soru ekle formunu aç"}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronUp className="size-5" strokeWidth={2.5} aria-hidden />
          ) : (
            <Plus className="size-5" strokeWidth={2.5} aria-hidden />
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-0.5 py-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/90 dark:text-emerald-400/90">
            Soru ilerlemesi
          </p>
          <h2
            id="student-add-q-heading"
            className="text-base font-bold tracking-tight text-foreground sm:text-lg"
          >
            Soru ekle
          </h2>
          <p
            className={cn(
              "text-sm leading-snug text-foreground/70",
              !expanded && "line-clamp-1"
            )}
          >
            Ders ve konuyu seçin; çözdüğünüz soru sayısını kaydedin. Özet,
            istatistikler ve soru sekmesinde güncellenir.
          </p>
        </div>
      </div>

      {expanded && (
      <div
        id="student-add-q-panel"
        className="space-y-5 px-4 py-5 sm:px-7 sm:py-6"
      >
        <div className="grid max-w-xl gap-2">
          <Label
            htmlFor="saq-ders"
            className="text-xs font-semibold uppercase tracking-wide text-foreground/80"
          >
            Ders
          </Label>
          <Select
            value={subjectId ?? ""}
            onValueChange={(v) => {
              setSubjectId(v || null);
              setAnaKonu(null);
              setVideoAltLabel(null);
              setFlatTopicId(null);
            }}
          >
            <SelectTrigger id="saq-ders" className={fieldTriggerClass}>
              <SelectValue placeholder="Ders seçin" />
            </SelectTrigger>
            <SelectContent>
              {sortedSubjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {videoCurriculum && subjectId && (
          <div className="grid gap-2 sm:max-w-xl">
            <Label
              htmlFor="saq-ana"
              className="text-xs font-semibold uppercase tracking-wide text-foreground/80"
            >
              Ana konu
            </Label>
            <Select
              value={anaKonu ?? ""}
              onValueChange={(v) => {
                setAnaKonu(v || null);
                setVideoAltLabel(null);
              }}
            >
              <SelectTrigger id="saq-ana" className={fieldTriggerClass}>
                <SelectValue placeholder="Ana konu seçin" />
              </SelectTrigger>
              <SelectContent>
                {videoCurriculum.map((g) => (
                  <SelectItem key={g.anaKonu} value={g.anaKonu}>
                    {g.anaKonu}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {videoCurriculum && subjectId && (
          <div className="grid gap-2 sm:max-w-2xl">
            <Label
              htmlFor="saq-alt"
              className="text-xs font-semibold uppercase tracking-wide text-foreground/80"
            >
              Konu / video
            </Label>
            <Select
              key={anaKonu ?? "no-ana"}
              value={videoAltLabel ?? ""}
              onValueChange={(v) => setVideoAltLabel(v || null)}
              disabled={!anaKonu || altKonular.length === 0}
            >
              <SelectTrigger id="saq-alt" className={fieldTriggerClass}>
                <SelectValue
                  placeholder={
                    anaKonu ? "Alt konu seçin" : "Önce ana konu seçin"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {altKonular.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!videoCurriculum && subjectId && (
          <div className="grid max-w-xl gap-2">
            <Label
              htmlFor="saq-konu"
              className="text-xs font-semibold uppercase tracking-wide text-foreground/80"
            >
              Konu
            </Label>
            <Select
              value={flatTopicId ?? ""}
              onValueChange={(v) => setFlatTopicId(v || null)}
              disabled={topicsForSubject.length === 0}
            >
              <SelectTrigger id="saq-konu" className={fieldTriggerClass}>
                <SelectValue placeholder="Konu seçin" />
              </SelectTrigger>
              <SelectContent>
                {topicsForSubject.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {videoCurriculum && videoAltLabel && !resolvedTopicId && (
          <p className="rounded-xl border border-amber-200/60 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            Bu konu veritabanında yok. Yönetici SQL dosyalarıyla konuları
            yüklediğinden emin olun.
          </p>
        )}

        <div className="space-y-4 rounded-2xl border border-emerald-200/40 bg-emerald-50/40 p-4 dark:border-emerald-900/35 dark:bg-emerald-950/25">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80 dark:text-emerald-300/90">
            Miktar
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                size="lg"
                className={cn(
                  "min-w-[4.25rem] rounded-xl border-emerald-300/70 bg-background font-bold tabular-nums text-emerald-900",
                  "hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-700/60 dark:bg-background dark:text-emerald-50",
                  "dark:hover:border-emerald-500 dark:hover:bg-emerald-950/80"
                )}
                disabled={!canAdd}
                onClick={() => runAdd(n)}
              >
                +{n}
              </Button>
            ))}
          </div>

          <form
            onSubmit={onCustomSubmit}
            className="flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="grid min-w-0 flex-1 gap-2">
              <Label
                htmlFor="saq-custom"
                className="text-xs font-semibold uppercase tracking-wide text-foreground/80"
              >
                Kendi sayınız
              </Label>
              <Input
                id="saq-custom"
                inputMode="numeric"
                placeholder="Örn. 25"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                disabled={pending}
                className="h-11 rounded-2xl border-emerald-200/70 bg-background shadow-none dark:border-emerald-800/50"
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-11 shrink-0 rounded-2xl bg-emerald-600 px-8 font-semibold text-white shadow-md hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              disabled={!canAdd}
            >
              Ekle
            </Button>
          </form>
        </div>

        {error && (
          <p
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
      )}
    </section>
  );
}
