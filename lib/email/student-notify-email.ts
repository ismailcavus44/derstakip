import { getAuthUserEmailById } from "@/lib/supabase/admin";

/**
 * Auth’taki demo adres yerine öğrenciye bildirim gidecek gerçek e-posta.
 *
 * 1) STUDENT_NOTIFY_EMAILS — JSON: { "öğrenci-uuid": "mail@..." }
 * 2) STUDENT_NOTIFY_USER_ID + STUDENT_NOTIFY_EMAIL — tek öğrenci eşlemesi
 * 3) Aksi halde SUPABASE_SERVICE_ROLE_KEY varsa öğrencinin auth kayıt e-postası
 */

export function getNotificationEmailForStudent(studentId: string): string | null {
  const sid = studentId.trim();
  if (!sid) return null;

  const jsonRaw = process.env.STUDENT_NOTIFY_EMAILS?.trim();
  if (jsonRaw) {
    try {
      const map = JSON.parse(jsonRaw) as Record<string, string>;
      const fromMap = map[sid]?.trim();
      if (fromMap) return fromMap;
    } catch {
      // geçersiz JSON — aşağıdaki tek çift denenir
    }
  }

  const uid = process.env.STUDENT_NOTIFY_USER_ID?.trim();
  const email = process.env.STUDENT_NOTIFY_EMAIL?.trim();
  if (uid && email && sid === uid) return email;

  return null;
}

/** Görev bildirimi: önce env eşlemesi, yoksa kayıt e-postası (service role gerekir). */
export async function resolveTaskNotificationEmail(
  studentId: string
): Promise<string | null> {
  const mapped = getNotificationEmailForStudent(studentId);
  if (mapped) return mapped;
  return getAuthUserEmailById(studentId);
}
