/**
 * Deneme sınavı hedef süreleri (dk) — öğrenci gerçek süreyi tamamlarken girer; bu değerler tavsiye.
 * Matematik + geometri tek deneme kolu (aynı süre).
 */

export type DenemeBranch =
  | "turkce"
  | "matematik_geometri"
  | "tarih"
  | "cografya"
  | "vatandaslik"
  | "diger";

export const DENEME_BRANCH_LABELS: Record<DenemeBranch, string> = {
  turkce: "Türkçe",
  matematik_geometri: "Matematik + Geometri",
  tarih: "Tarih",
  cografya: "Coğrafya",
  vatandaslik: "Vatandaşlık",
  diger: "Diğer",
};

const TARGET: Record<Exclude<DenemeBranch, "diger">, number> = {
  turkce: 35,
  matematik_geometri: 35,
  tarih: 45,
  cografya: 15,
  vatandaslik: 10,
};

const DEFAULT_OTHER = 40;

export function denemeBranchAndTargetFromSubjectSlug(
  slug: string | null | undefined
): { branch: DenemeBranch; targetMinutes: number } {
  const s = (slug ?? "").toLowerCase().trim();
  if (s === "turkce") return { branch: "turkce", targetMinutes: TARGET.turkce };
  if (s === "matematik" || s === "geometri") {
    return { branch: "matematik_geometri", targetMinutes: TARGET.matematik_geometri };
  }
  if (s === "tarih") return { branch: "tarih", targetMinutes: TARGET.tarih };
  if (s === "cografya" || s === "coğrafya") {
    return { branch: "cografya", targetMinutes: TARGET.cografya };
  }
  if (s === "vatandaslik" || s === "vatandaşlık") {
    return { branch: "vatandaslik", targetMinutes: TARGET.vatandaslik };
  }
  return { branch: "diger", targetMinutes: DEFAULT_OTHER };
}
