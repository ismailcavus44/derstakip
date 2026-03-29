/** Öğrencinin soru yüklerken bildirdiği durum — seçilen konuda eksiklik takibinde kullanılır. */
export type QuestionIssueKind = "could_not_solve" | "wrong_answer";

export const QUESTION_ISSUE_KIND_LABELS: Record<QuestionIssueKind, string> = {
  could_not_solve: "Çözemedim",
  wrong_answer: "Yanlış yaptım",
};

/** Konu “eksiklik puanı”: çözülemeyen daha ağırlıklı. */
export const QUESTION_ISSUE_WEAKNESS_WEIGHT: Record<QuestionIssueKind, number> = {
  could_not_solve: 2,
  wrong_answer: 1,
};

export function parseQuestionIssueKind(raw: unknown): QuestionIssueKind {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "wrong_answer") return "wrong_answer";
  return "could_not_solve";
}

export function weaknessPointsForCounts(
  couldNotSolve: number,
  wrong: number
): number {
  return (
    couldNotSolve * QUESTION_ISSUE_WEAKNESS_WEIGHT.could_not_solve +
    wrong * QUESTION_ISSUE_WEAKNESS_WEIGHT.wrong_answer
  );
}
