import {
  getTasks,
  getTeacherNotifications,
} from "@/app/teacher/actions";
import { TeacherDashboard } from "@/app/teacher/teacher-dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [tasks, notifications, profileRes] = await Promise.all([
    getTasks(),
    getTeacherNotifications(),
    user
      ? supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const teacherName =
    profileRes.data?.full_name?.trim() || "Öğretmenim";

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
