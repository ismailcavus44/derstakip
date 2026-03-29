"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  dismissTeacherTopicWeakness,
  type StudentRow,
  type TeacherTopicWeaknessRollupRow,
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

type Props = {
  students: StudentRow[];
  rows: TeacherTopicWeaknessRollupRow[];
  filterStudentId: string | null;
};

export function TeacherKonuEksikleriClient({
  students,
  rows,
  filterStudentId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmRow, setConfirmRow] = useState<TeacherTopicWeaknessRollupRow | null>(
    null
  );

  const studentItems = useMemo(
    () =>
      students.map((s) => ({
        value: s.id,
        label: s.full_name?.trim() || "İsimsiz",
      })),
    [students]
  );

  function runDismiss() {
    if (!confirmRow) return;
    const { student_id, topic_id } = confirmRow;
    setConfirmRow(null);
    startTransition(async () => {
      const res = await dismissTeacherTopicWeakness(student_id, topic_id);
      if (res.error) window.alert(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Konu eksik takibi</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Öğrencinin soru yüklerken seçtiği konuya göre, çözümde zorlandığı kayıtlar burada
            listelenir. Uygun gördüğün satırı kaldırabilirsin; öğrenci aynı konuda yeniden
            soru gönderirse satır tekrar görünür.
          </p>
        </div>
        <div className="w-full min-w-[12rem] sm:w-64">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Öğrenci filtresi
          </label>
          <Select
            value={filterStudentId ?? "__all__"}
            onValueChange={(v) => {
              if (!v || v === "__all__") {
                router.push("/teacher/konu-eksikleri");
              } else {
                router.push(
                  `/teacher/konu-eksikleri?ogrenci=${encodeURIComponent(v)}`
                );
              }
            }}
            items={[
              { value: "__all__", label: "Tümü" },
              ...studentItems.map((s) => ({ value: s.value, label: s.label })),
            ]}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Öğrenci" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tümü</SelectItem>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name?.trim() || "İsimsiz"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          Listelenecek eksik konu yok. Veri yoksa veya soru gönderimlerinde konu türü henüz
          tanımlı değilse{" "}
          <code className="rounded bg-muted px-1 text-xs">student-question-issue-kind.sql</code>{" "}
          çalıştırılmış olmalı. Satırları temizlediysen, yalnızca temizleme sonrası yeni
          gönderimler tekrar listelenir.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Öğrenci</TableHead>
                <TableHead>Konu</TableHead>
                <TableHead className="whitespace-nowrap">Son bildirim</TableHead>
                <TableHead className="w-[1%] text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const line = [r.subject_name, r.topic_name].filter(Boolean).join(" · ");
                return (
                  <TableRow key={`${r.student_id}-${r.topic_id}`}>
                    <TableCell className="font-medium">{r.student_name}</TableCell>
                    <TableCell className="max-w-[18rem]">{line}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(r.last_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={isPending}
                        onClick={() => setConfirmRow(r)}
                      >
                        Listeden kaldır
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={!!confirmRow}
        onOpenChange={(open) => {
          if (!open) setConfirmRow(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Listeden kaldırılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu öğrenci ve konu satırı sende gizlenir. Öğrenci aynı konuda yeni bir soru
              (çözemedim / yanlış) gönderirse satır yeniden listelenir; tek seferlik silme
              konuyu kalıcı olarak kapatmaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl"
              onClick={(e) => {
                e.preventDefault();
                runDismiss();
              }}
            >
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
