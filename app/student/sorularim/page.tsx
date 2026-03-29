import { redirect } from "next/navigation";

import { listMyQuestionSubmissions } from "@/app/student/actions";
import { StudentSorularimClient } from "@/app/student/sorularim/student-sorularim-client";
import { StudentAppHeader } from "@/components/student-app-header";
import { getCachedAuth } from "@/lib/auth/cached-auth";

export default async function StudentSorularimPage() {
  const { user, profile } = await getCachedAuth();

  if (!user) redirect("/login");

  const displayName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "Öğrenci";

  const rows = await listMyQuestionSubmissions();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <StudentAppHeader displayName={displayName} active="sorularim" />
      <StudentSorularimClient rows={rows} />
    </div>
  );
}
