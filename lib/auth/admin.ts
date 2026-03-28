/** Supabase SQL ve .env ADMIN_USER_ID ile aynı UUID olmalı (admin-panel.sql). */
export const ADMIN_USER_ID =
  process.env.ADMIN_USER_ID?.trim() ??
  "a75e9080-86e4-4663-a4d5-6c91f6b83546";

export function isAdminUserId(userId: string | undefined | null): boolean {
  return !!userId && userId === ADMIN_USER_ID;
}
