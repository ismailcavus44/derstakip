import { redirect } from "next/navigation";

import {
  getStudents,
  getTeacherTopicWeaknessRollup,
} from "@/app/teacher/actions";

import { TeacherKonuEksikleriClient } from "./teacher-konu-eksikleri-client";

type PageProps = {
  searchParams?: Promise<{ ogrenci?: string }>;
};

export default async function TeacherKonuEksikleriPage({
  searchParams,
}: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const students = await getStudents();
  const validIds = new Set(students.map((s) => s.id));
  const rawFilter = sp.ogrenci?.trim();
  if (rawFilter && !validIds.has(rawFilter)) {
    redirect("/teacher/konu-eksikleri");
  }
  const filterStudentId = rawFilter && validIds.has(rawFilter) ? rawFilter : null;

  const rows = await getTeacherTopicWeaknessRollup(filterStudentId);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <TeacherKonuEksikleriClient
        students={students}
        rows={rows}
        filterStudentId={filterStudentId}
      />
    </div>
  );
}
