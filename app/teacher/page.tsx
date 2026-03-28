import {
  getTasks,
  getTeacherNotifications,
} from "@/app/teacher/actions";
import { TeacherDashboard } from "@/app/teacher/teacher-dashboard";
import { getCachedAuth } from "@/lib/auth/cached-auth";

export default async function TeacherPage() {
  const { profile } = await getCachedAuth();

  const [tasks, notifications] = await Promise.all([
    getTasks(),
    getTeacherNotifications(),
  ]);

  const teacherName = profile?.full_name?.trim() || "Öğretmenim";

  const activeCount = tasks.filter((t) => t.status === "pending").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <TeacherDashboard
      notifications={notifications}
      teacherName={teacherName}
      activeCount={activeCount}
      completedCount={completedCount}
    />
  );
}
