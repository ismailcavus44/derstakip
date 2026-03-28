"use client";

import { useActionState, useState, useTransition } from "react";

import {
  createStudentUser,
  deleteStudentUser,
  setStudentTeacher,
  type AdminStudentRow,
  type AdminTeacherRow,
} from "@/app/admin/actions";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TEACHER_NONE = "__none__";

type Props = {
  teachers: AdminTeacherRow[];
  students: AdminStudentRow[];
};

export function AdminPanel({ teachers, students }: Props) {
  const [createState, createAction, createPending] = useActionState(
    createStudentUser,
    {} as { error?: string }
  );
  const [assignPending, startAssign] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [localTeacher, setLocalTeacher] = useState<Record<string, string>>({});

  function teacherSelectValue(student: AdminStudentRow) {
    if (student.id in localTeacher) {
      return localTeacher[student.id]!;
    }
    return student.teacher_id ?? TEACHER_NONE;
  }

  function saveAssignment(student: AdminStudentRow) {
    const raw = localTeacher[student.id] ?? student.teacher_id ?? TEACHER_NONE;
    const teacherId = raw === TEACHER_NONE ? null : raw;
    startAssign(async () => {
      const res = await setStudentTeacher(student.id, teacherId);
      if (res.error) {
        alert(res.error);
        return;
      }
      setLocalTeacher((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });
    });
  }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startDelete(async () => {
      const res = await deleteStudentUser(id);
      if (res.error) alert(res.error);
    });
  }

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-8 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Öğrenci yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Hesap oluşturun, öğretmene bağlayın veya bağlantıyı kaldırın. Görevler yalnızca
          öğretmen hesabıyla, öğretmen panelindeki Görevler bölümünden yönetilir.
        </p>
      </div>

      <Card className="rounded-3xl border-border/60">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Yeni öğrenci</CardTitle>
          <CardDescription>
            Hesap oluşturulur; isteğe bağlı olarak bir öğretmene atanır (
            <code className="rounded bg-muted px-1">teacher_id</code> otomatik).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="admin-new-email">E-posta</Label>
              <Input
                id="admin-new-email"
                name="email"
                type="email"
                required
                autoComplete="off"
                className="rounded-2xl"
                placeholder="ogrenci@okul.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-new-pass">Şifre</Label>
              <Input
                id="admin-new-pass"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="rounded-2xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-new-name">Ad soyad</Label>
              <Input
                id="admin-new-name"
                name="full_name"
                required
                className="rounded-2xl"
                placeholder="Ad Soyad"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="admin-new-teacher">Öğretmen (isteğe bağlı)</Label>
              <select
                id="admin-new-teacher"
                name="teacher_id"
                defaultValue={TEACHER_NONE}
                className="border-input bg-background h-10 w-full rounded-2xl border px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={TEACHER_NONE}>Atanmadı</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name || t.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            {createState?.error && (
              <p
                className="text-sm font-medium text-destructive sm:col-span-2"
                role="alert"
              >
                {createState.error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button
                type="submit"
                className="rounded-2xl"
                disabled={createPending}
              >
                {createPending ? "Oluşturuluyor…" : "Öğrenci oluştur"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/60">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Öğrenciler</CardTitle>
          <CardDescription>
            Öğretmen atamasını güncelleyin veya hesabı tamamen silin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz öğrenci kaydı yok.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-end sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold">{s.full_name || "—"}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {s.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {s.id}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-72">
                    <Label className="text-xs">Öğretmen</Label>
                    <Select
                      value={teacherSelectValue(s)}
                      onValueChange={(v) => {
                        const next = v ?? TEACHER_NONE;
                        setLocalTeacher((prev) => ({
                          ...prev,
                          [s.id]: next,
                        }));
                      }}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TEACHER_NONE}>Atanmadı</SelectItem>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.full_name || t.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl"
                        disabled={assignPending}
                        onClick={() => saveAssignment(s)}
                      >
                        {assignPending ? "Kaydediliyor…" : "Atamayı kaydet"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="rounded-xl"
                        disabled={deletePending}
                        onClick={() => setDeleteId(s.id)}
                      >
                        Hesabı sil
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Öğrenci hesabını sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Öğrencinin görevleri ve profili de silinir.
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
