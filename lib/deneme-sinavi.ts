/** Deneme sınavı ödevi: ders grubu ve önerilen süre (dk). Öğrenci bitirince gerçek süreyi girer. */

export type DenemeBranch =
  | "turkce"
  | "matematik_geometri"
  | "tarih"
  | "cografya"
  | "vatandaslik";

export const DENEME_BRANCH_LABELS: Record<DenemeBranch, string> = {
  turkce: "Türkçe",
  matematik_geometri: "Matematik + Geometri",
  tarih: "Tarih",
  cografya: "Coğrafya",
  vatandaslik: "Vatandaşlık",
};

/** Önerilen süre (dakika) — ilerlemede karşılaştırma için; öğrenci gerçek süreyi ayrı yazar. */
export const DENEME_TARGET_MINUTES: Record<DenemeBranch, number> = {
  turkce: 35,
  matematik_geometri: 45,
  tarih: 15,
  cografya: 10,
  vatandaslik: 8,
};

export function parseDenemeBranch(raw: unknown): DenemeBranch | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (
    s === "turkce" ||
    s === "matematik_geometri" ||
    s === "tarih" ||
    s === "cografya" ||
    s === "vatandaslik"
  ) {
    return s;
  }
  return null;
}

export function subjectSlugAllowedForDenemeBranch(
  branch: DenemeBranch,
  subjectSlug: string
): boolean {
  switch (branch) {
    case "turkce":
      return subjectSlug === "turkce";
    case "matematik_geometri":
      return subjectSlug === "matematik" || subjectSlug === "geometri";
    case "tarih":
      return subjectSlug === "tarih";
    case "cografya":
      return subjectSlug === "cografya";
    case "vatandaslik":
      return subjectSlug === "vatandaslik";
    default:
      return false;
  }
}

export const DENEME_BRANCH_OPTIONS: { value: DenemeBranch; label: string }[] = (
  Object.keys(DENEME_TARGET_MINUTES) as DenemeBranch[]
).map((value) => ({
  value,
  label: `${DENEME_BRANCH_LABELS[value]} (${DENEME_TARGET_MINUTES[value]} dk öneri)`,
}));
