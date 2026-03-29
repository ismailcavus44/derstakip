import { getTeacherStudentQuestionSubmissions } from "@/app/teacher/actions";
import { TeacherSorularClient } from "@/app/teacher/sorular/teacher-sorular-client";

export default async function TeacherSorularPage() {
  const rows = await getTeacherStudentQuestionSubmissions();
  return <TeacherSorularClient rows={rows} />;
}
