import type { AnaAltGroup } from "@/lib/ana-alt-types";
import { COGRAFYA_ANA_ALT } from "@/lib/cografya-curriculum";
import { TARIH_ANA_ALT } from "@/lib/tarih-curriculum";

export type { AnaAltGroup };

/** Ana + alt video listesi olan ders slug’ları için veri */
export function videoCurriculumBySlug(
  slug: string | undefined
): AnaAltGroup[] | null {
  if (slug === "tarih") return TARIH_ANA_ALT;
  if (slug === "cografya") return COGRAFYA_ANA_ALT;
  return null;
}
