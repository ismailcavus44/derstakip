import { redirect } from "next/navigation";
import { getCachedAuth } from "@/lib/auth/cached-auth";

export default async function Home() {
  const { user, profile } = await getCachedAuth();

  if (!user) {
    redirect("/login");
  }

  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "teacher") redirect("/teacher");
  if (profile?.role === "student") redirect("/student");

  redirect("/login");
}
