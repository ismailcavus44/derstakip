/**
 * Auth’taki demo adres yerine öğrenciye bildirim gidecek gerçek e-posta.
 * Service role / admin API kullanılmaz.
 *
 * 1) STUDENT_NOTIFY_EMAILS — JSON: { "öğrenci-uuid": "mail@..." }
 * 2) STUDENT_NOTIFY_USER_ID + STUDENT_NOTIFY_EMAIL — tek öğrenci eşlemesi
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
