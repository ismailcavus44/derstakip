"use client";

import { ChevronDown, ListTodo, Pencil, PlusIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import type { SubjectRow, TopicRow } from "@/app/curriculum/actions";
import {
  createTask,
  deleteTeacherTask,
  updateTeacherTask,
  type StudentRow,
  type TaskWithStudent,
} from "@/app/teacher/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { appPanelClassName } from "@/components/app-shell";
import {
  DENEME_BRANCH_LABELS,
  denemeBranchAndTargetFromSubjectSlug,
} from "@/lib/deneme-exam";
import { videoCurriculumBySlug } from "@/lib/video-curriculum";
import { cn } from "@/lib/utils";

const TASK_KIND_ITEMS = [
  { value: "soru_cozumu", label: "Soru çözümü" },
  { value: "konu_anlatimi", label: "Konu anlatımı" },
  { value: "deneme_sinavi", label: "Deneme sınavı" },
] as const;

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

function StatusBadge({ status }: { status: TaskWithStudent["status"] }) {
  if (status === "completed") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
      >
        Tamamlandı
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      Bekliyor
    </Badge>
  );
}

type Props = {
  students: StudentRow[];
  tasks: TaskWithStudent[];
  subjects: SubjectRow[];
  topics: TopicRow[];
};

function taskCurriculumLine(t: TaskWithStudent) {
  const parts: string[] = [];
  if (t.subject_name) parts.push(t.subject_name);
  if (t.topic_name) parts.push(t.topic_name);
  if (t.task_kind === "konu_anlatimi") parts.push("Konu anlatımı");
  else if (t.task_kind === "soru_cozumu") parts.push("Soru çözümü");
  else if (t.task_kind === "deneme_sinavi") parts.push("Deneme sınavı");
  return parts.length ? parts.join(" · ") : null;
}

function TaskListItem({
  t,
  onEdit,
  onDelete,
}: {
  t: TaskWithStudent;
  onEdit: (task: TaskWithStudent) => void;
  onDelete: (id: string) => void;
}) {
  const curriculumLine = taskCurriculumLine(t);
  return (
    <li>
      <Card className="rounded-3xl border-border/60">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Öğrenci
              </p>
              <p className="truncate font-semibold text-foreground">
                {t.student_name}
              </p>
            </div>
            <StatusBadge status={t.status} />
          </div>
          {curriculumLine && (
            <p className="text-xs font-medium text-primary">{curriculumLine}</p>
          )}
          <p className="text-base font-bold leading-snug">{t.title}</p>
          <p
            className={cn(
              "text-sm leading-relaxed text-muted-foreground",
              !t.description?.trim() && "italic opacity-70"
            )}
          >
            {t.description?.trim() || "Açıklama yok."}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
          {t.task_kind === "deneme_sinavi" && t.deneme_target_minutes != null && (
            <p className="text-xs font-medium text-sky-800 dark:text-sky-200">
              Önerilen süre (tavsiye): {t.deneme_target_minutes} dk
            </p>
          )}
          {t.task_kind === "deneme_sinavi" &&
            t.status === "completed" &&
            t.deneme_correct != null &&
            t.deneme_wrong != null &&
            t.deneme_actual_minutes != null && (
              <p className="text-xs text-muted-foreground">
                Öğrenci: {t.deneme_correct} D / {t.deneme_wrong} Y —{" "}
                {t.deneme_actual_minutes} dk
              </p>
            )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => onEdit(t)}
            >
              <Pencil className="mr-1 size-3.5" />
              Düzenle
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="rounded-xl"
              onClick={() => onDelete(t.id)}
            >
              <Trash2 className="mr-1 size-3.5" />
              Sil
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

export function TeacherTasksClient({
  students,
  tasks,
  subjects,
  topics,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [createStudentId, setCreateStudentId] = useState<string | null>(null);
  const [createSubjectId, setCreateSubjectId] = useState<string | null>(null);
  const [createTopicId, setCreateTopicId] = useState<string | null>(null);
  const [createTaskKind, setCreateTaskKind] = useState<
    "soru_cozumu" | "konu_anlatimi" | "deneme_sinavi"
  >("soru_cozumu");
  const [createKey, setCreateKey] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);
  /** Tarih / Coğrafya: bağımlı ana konu → alt konu (video) */
  const [videoAnaKonu, setVideoAnaKonu] = useState<string | null>(null);
  const [videoAltKonu, setVideoAltKonu] = useState<string | null>(null);

  const [editTask, setEditTask] = useState<TaskWithStudent | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status === "pending"),
    [tasks]
  );
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === "completed"),
    [tasks]
  );

  const studentItems = useMemo(
    () =>
      students.map((s) => ({
        value: s.id,
        label: s.full_name?.trim() || "İsimsiz öğrenci",
      })),
    [students]
  );

  const subjectItems = useMemo(
    () => subjects.map((s) => ({ value: s.id, label: s.name })),
    [subjects]
  );

  const topicItems = useMemo(() => {
    if (!createSubjectId) return [];
    return topics
      .filter((t) => t.subject_id === createSubjectId)
      .map((t) => ({ value: t.id, label: t.name }));
  }, [topics, createSubjectId]);

  const createSubjectSlug = useMemo(() => {
    if (!createSubjectId) return undefined;
    return subjects.find((s) => s.id === createSubjectId)?.slug;
  }, [createSubjectId, subjects]);

  const videoCurriculum = useMemo(
    () => videoCurriculumBySlug(createSubjectSlug),
    [createSubjectSlug]
  );

  const denemePreview = useMemo(() => {
    if (!createSubjectSlug) return null;
    const { branch, targetMinutes } =
      denemeBranchAndTargetFromSubjectSlug(createSubjectSlug);
    return {
      branch,
      targetMinutes,
      label: DENEME_BRANCH_LABELS[branch],
    };
  }, [createSubjectSlug]);

  const isVideoSubject = videoCurriculum !== null;

  const videoAltList = useMemo(() => {
    if (!videoAnaKonu || !videoCurriculum) return [];
    return (
      videoCurriculum.find((g) => g.anaKonu === videoAnaKonu)?.altKonular ?? []
    );
  }, [videoAnaKonu, videoCurriculum]);

  /** Seçilen alt başlık, topics tablosundaki name ile birebir eşleşmeli */
  const videoResolvedTopicId = useMemo(() => {
    if (!isVideoSubject || !createSubjectId || !videoAltKonu) return null;
    return (
      topics.find(
        (t) =>
          t.subject_id === createSubjectId && t.name === videoAltKonu
      )?.id ?? null
    );
  }, [isVideoSubject, createSubjectId, videoAltKonu, topics]);

  const effectiveCreateTopicId = isVideoSubject
    ? videoResolvedTopicId
    : createTopicId;

  function onCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    const form = e.currentTarget;
    if (!createStudentId) {
      setCreateError("Öğrenci seçin.");
      return;
    }
    if (!createSubjectId) {
      setCreateError("Ders seçin.");
      return;
    }
    if (createTaskKind !== "deneme_sinavi") {
      if (isVideoSubject) {
        if (!videoAnaKonu || !videoAltKonu) {
          setCreateError("Ana konu ve alt konu / video seçin.");
          return;
        }
        if (!videoResolvedTopicId) {
          setCreateError(
            "Seçilen alt konu müfredatta bulunamadı. Supabase’de tarih-video-topics.sql veya cografya-video-topics.sql dosyasını (ders slug’ına göre) çalıştırın."
          );
          return;
        }
      } else if (!createTopicId) {
        setCreateError("Konu seçin.");
        return;
      }
    }
    if (createTaskKind === "soru_cozumu") {
      const raw = form.querySelector<HTMLInputElement>(
        'input[name="question_count"]'
      )?.value;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1) {
        setCreateError("Soru çözümü için geçerli bir soru sayısı girin.");
        return;
      }
    }
    /* deneme_sinavi: soru sayısı yok */
    const fd = new FormData(form);
    fd.set("student_id", createStudentId);
    if (createTaskKind === "deneme_sinavi") {
      fd.set("subject_id", createSubjectId);
      fd.set("topic_id", "");
    } else {
      fd.set("topic_id", effectiveCreateTopicId ?? "");
    }
    fd.set("task_kind", createTaskKind);

    startTransition(async () => {
      const res = await createTask(fd);
      if (res.error) {
        setCreateError(res.error);
        return;
      }
      form.reset();
      setCreateStudentId(null);
      setCreateSubjectId(null);
      setCreateTopicId(null);
      setVideoAnaKonu(null);
      setVideoAltKonu(null);
      setCreateTaskKind("soru_cozumu");
      setCreateKey((k) => k + 1);
      setCreateOpen(false);
      router.refresh();
    });
  }

  function onEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError(null);
    if (!editTask) return;
    const form = e.currentTarget;
    const fd = new FormData(form);

    startTransition(async () => {
      const res = await updateTeacherTask(fd);
      if (res.error) {
        setEditError(res.error);
        return;
      }
      setEditTask(null);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      const res = await deleteTeacherTask(id);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="relative mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-4 pb-28 pt-6">
      <div
        className={cn(
          appPanelClassName(
            "border-sky-200/50 bg-gradient-to-br from-sky-50/85 via-card/90 to-card/80 dark:border-sky-900/40 dark:from-sky-950/35 dark:via-card/80 dark:to-card/70"
          ),
          "p-5 sm:p-6"
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md ring-4 ring-primary/15">
            <ListTodo className="size-6" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Görevler
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Öğrencilerine verdiğin görevleri oluştur, düzenle veya sil.
              Değişiklikler öğrenci ekranında güncellenir.
            </p>
          </div>
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) {
            setCreateError(null);
            setCreateStudentId(null);
            setCreateSubjectId(null);
            setCreateTopicId(null);
            setVideoAnaKonu(null);
            setVideoAltKonu(null);
            setCreateTaskKind("soru_cozumu");
            setCreateKey((k) => k + 1);
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Ödev / görev oluştur</DialogTitle>
            <DialogDescription>
              Öğrenci ve dersi seçin. Deneme sınavında yalnızca ders seçilir (konu
              yok). Diğer görevlerde Tarih ve Coğrafya için önce ana konu, sonra alt
              konu / video; diğer derslerde tek konu listesi kullanılır.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tt-student">Öğrenci</Label>
              <Select
                key={createKey}
                value={createStudentId ?? ""}
                onValueChange={(v) => setCreateStudentId(v ? v : null)}
                items={studentItems}
                disabled={students.length === 0}
              >
                <SelectTrigger id="tt-student" className="w-full min-w-0 rounded-2xl">
                  <SelectValue placeholder="Öğrenci seçin" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name?.trim() || "İsimsiz öğrenci"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {students.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Henüz size bağlı öğrenci yok.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tt-subject">Ders</Label>
              <Select
                value={createSubjectId ?? ""}
                onValueChange={(v) => {
                  setCreateSubjectId(v ? v : null);
                  setCreateTopicId(null);
                  setVideoAnaKonu(null);
                  setVideoAltKonu(null);
                }}
                items={subjectItems}
                disabled={subjects.length === 0}
              >
                <SelectTrigger id="tt-subject" className="w-full min-w-0 rounded-2xl">
                  <SelectValue placeholder="Ders seçin" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subjects.length === 0 && (
                <p className="text-xs text-destructive">
                  Müfredat bulunamadı. Supabase&apos;de curriculum-and-progress.sql
                  çalıştırıldığından emin olun.
                </p>
              )}
            </div>
            <Fragment key={createSubjectId ?? "no-subject"}>
              {createTaskKind === "deneme_sinavi" ? (
                <p className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-950 dark:text-sky-100">
                  Bu görev türünde konu seçilmez; sadece ders yeterli. Öğrenci
                  tamamlarken doğru, yanlış ve süreyi girecek.
                </p>
              ) : null}
              {createTaskKind !== "deneme_sinavi" && isVideoSubject && videoCurriculum ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="tt-video-ana">Ana konu</Label>
                    <Select
                      value={videoAnaKonu ?? ""}
                      onValueChange={(v) => {
                        setVideoAnaKonu(v ? v : null);
                        setVideoAltKonu(null);
                      }}
                      items={videoCurriculum.map((g) => ({
                        value: g.anaKonu,
                        label: g.anaKonu,
                      }))}
                    >
                      <SelectTrigger
                        id="tt-video-ana"
                        className="w-full min-w-0 rounded-2xl"
                      >
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
                  <div className="grid gap-2">
                    <Label htmlFor="tt-video-alt">Alt konu / video</Label>
                    <Select
                      key={videoAnaKonu ?? "no-ana"}
                      value={videoAltKonu ?? ""}
                      onValueChange={(v) => setVideoAltKonu(v ? v : null)}
                      items={videoAltList.map((label) => ({
                        value: label,
                        label,
                      }))}
                      disabled={!videoAnaKonu || videoAltList.length === 0}
                    >
                      <SelectTrigger
                        id="tt-video-alt"
                        className="w-full min-w-0 rounded-2xl"
                      >
                        <SelectValue
                          placeholder={
                            videoAnaKonu
                              ? "Alt konu seçin"
                              : "Önce ana konu seçin"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {videoAltList.map((label) => (
                          <SelectItem key={label} value={label}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {videoAnaKonu && videoAltKonu && !videoResolvedTopicId && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Bu alt konu veritabanında yok. Supabase’de{" "}
                        <code className="rounded bg-muted px-1">
                          {createSubjectSlug === "cografya"
                            ? "cografya-video-topics.sql"
                            : "tarih-video-topics.sql"}
                        </code>{" "}
                        dosyasını çalıştırın.
                      </p>
                    )}
                  </div>
                </>
              ) : createTaskKind !== "deneme_sinavi" ? (
                <div className="grid gap-2">
                  <Label htmlFor="tt-topic">Konu</Label>
                  <Select
                    value={createTopicId ?? ""}
                    onValueChange={(v) => setCreateTopicId(v ? v : null)}
                    items={topicItems}
                    disabled={
                      !createSubjectId ||
                      topics.filter((t) => t.subject_id === createSubjectId)
                        .length === 0
                    }
                  >
                    <SelectTrigger id="tt-topic" className="w-full min-w-0 rounded-2xl">
                      <SelectValue placeholder="Konu seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {topics
                        .filter((t) => t.subject_id === createSubjectId)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </Fragment>
            <div className="grid gap-2">
              <Label htmlFor="tt-kind">Görev türü</Label>
              <Select
                value={createTaskKind}
                onValueChange={(v) =>
                  setCreateTaskKind(
                    v === "konu_anlatimi"
                      ? "konu_anlatimi"
                      : v === "deneme_sinavi"
                        ? "deneme_sinavi"
                        : "soru_cozumu"
                  )
                }
                items={[...TASK_KIND_ITEMS]}
              >
                <SelectTrigger id="tt-kind" className="w-full min-w-0 rounded-2xl">
                  <SelectValue placeholder="Görev türü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soru_cozumu">Soru çözümü</SelectItem>
                  <SelectItem value="konu_anlatimi">Konu anlatımı</SelectItem>
                  <SelectItem value="deneme_sinavi">Deneme sınavı</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createTaskKind === "deneme_sinavi" && createSubjectId && denemePreview && (
              <p className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-950 dark:text-sky-100">
                <span className="font-semibold">Önerilen süre (tavsiye): </span>
                {denemePreview.targetMinutes} dk ({denemePreview.label}). Öğrenci
                denemeyi bitirince gerçek süresini ve doğru/yanlış sayısını
                girecek.
              </p>
            )}
            {createTaskKind === "soru_cozumu" && (
              <div className="grid gap-2">
                <Label htmlFor="tt-qcount">Çözülecek soru sayısı</Label>
                <Input
                  id="tt-qcount"
                  name="question_count"
                  type="number"
                  min={1}
                  max={10000}
                  defaultValue={40}
                  required
                  className="rounded-2xl"
                />
              </div>
            )}
            {createTaskKind === "konu_anlatimi" && (
              <div className="grid gap-2">
                <Label htmlFor="tt-followup">Konu sonrası soru sayısı</Label>
                <Input
                  id="tt-followup"
                  name="followup_question_count"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={20}
                  className="rounded-2xl"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="tt-desc">Not (isteğe bağlı)</Label>
              <Textarea
                id="tt-desc"
                name="description"
                rows={3}
                className="min-h-[80px] resize-y rounded-2xl"
                placeholder="Öğrenciye ek not"
              />
            </div>
            {createError && (
              <p className="text-sm font-medium text-destructive" role="alert">
                {createError}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => setCreateOpen(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                className="rounded-2xl"
                disabled={
                  isPending ||
                  !createStudentId ||
                  subjects.length === 0 ||
                  !createSubjectId ||
                  (createTaskKind !== "deneme_sinavi" && !effectiveCreateTopicId)
                }
              >
                {isPending ? "Gönderiliyor…" : "Ödevi ver"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTask}
        onOpenChange={(o) => {
          if (!o) {
            setEditTask(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Görevi düzenle</DialogTitle>
            <DialogDescription>
              Başlık, açıklama ve durum öğrenci tarafında güncellenir.
            </DialogDescription>
          </DialogHeader>
          {editTask && (
            <form
              key={editTask.id}
              onSubmit={onEditSubmit}
              className="grid gap-4"
            >
              <input type="hidden" name="task_id" value={editTask.id} />
              <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Öğrenci: </span>
                {editTask.student_name}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ett-title">Başlık</Label>
                <Input
                  id="ett-title"
                  name="title"
                  required
                  maxLength={500}
                  defaultValue={editTask.title}
                  className="rounded-2xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ett-desc">Açıklama</Label>
                <Textarea
                  id="ett-desc"
                  name="description"
                  rows={4}
                  defaultValue={editTask.description ?? ""}
                  className="min-h-[100px] resize-y rounded-2xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ett-status">Durum</Label>
                <select
                  id="ett-status"
                  name="status"
                  defaultValue={editTask.status}
                  className="border-input bg-background h-10 w-full rounded-2xl border px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="pending">Bekliyor</option>
                  <option value="completed">Tamamlandı</option>
                </select>
              </div>
              {editError && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {editError}
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setEditTask(null)}
                >
                  Vazgeç
                </Button>
                <Button type="submit" className="rounded-2xl" disabled={isPending}>
                  {isPending ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {tasks.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-border/80 bg-muted/30">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Henüz görev yok. Sağ alttaki + ile ekleyin.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {pendingTasks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Bekleyen ({pendingTasks.length})
              </h2>
              <ul className="flex flex-col gap-3">
                {pendingTasks.map((t) => (
                  <TaskListItem
                    key={t.id}
                    t={t}
                    onEdit={(task) => {
                      setEditError(null);
                      setEditTask(task);
                    }}
                    onDelete={(id) => setDeleteId(id)}
                  />
                ))}
              </ul>
            </section>
          )}
          {completedTasks.length > 0 && (
            <details
              className={cn(
                "group rounded-3xl border border-border/60 bg-card/50 backdrop-blur-sm",
                "open:shadow-sm open:ring-1 open:ring-border/40"
              )}
            >
              <summary
                className={cn(
                  "flex cursor-pointer list-none items-center justify-between gap-3 rounded-3xl px-4 py-3.5",
                  "text-left outline-none transition hover:bg-muted/40",
                  "[&::-webkit-details-marker]:hidden"
                )}
              >
                <span className="text-sm font-semibold text-foreground">
                  Tamamlanan görevler ({completedTasks.length})
                </span>
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="border-t border-border/50 px-4 pb-4 pt-2">
                <ul className="flex flex-col gap-3 pt-2">
                  {completedTasks.map((t) => (
                    <TaskListItem
                      key={t.id}
                      t={t}
                      onEdit={(task) => {
                        setEditError(null);
                        setEditTask(task);
                      }}
                      onDelete={(id) => setDeleteId(id)}
                    />
                  ))}
                </ul>
              </div>
            </details>
          )}
        </div>
      )}

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full ring-1 ring-border"
        onClick={() => setCreateOpen(true)}
        aria-label="Yeni görev ekle"
      >
        <PlusIcon className="size-7" />
      </Button>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Görevi sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Öğrenci ekranından da kalkar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
