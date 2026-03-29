export const STUDENT_QUESTION_BUCKET = "student-question-submissions";

export const MAX_STUDENT_QUESTION_BYTES = 10 * 1024 * 1024;

export const STUDENT_QUESTION_SIGNED_URL_SEC = 3600;

export const STUDENT_QUESTION_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
