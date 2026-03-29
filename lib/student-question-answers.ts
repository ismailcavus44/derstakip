/** Admin cevap görselleri — yol: {student_id}/{submission_id}/dosya */
export const QUESTION_ANSWER_BUCKET = "student-question-answers";

export const MAX_QUESTION_ANSWER_BYTES = 10 * 1024 * 1024;

export const QUESTION_ANSWER_SIGNED_URL_SEC = 3600;

/** Yalnızca görsel cevap */
export const QUESTION_ANSWER_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
