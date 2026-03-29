"use client";

import type { TopicRow } from "@/app/curriculum/actions";

type Props = {
  subjectId: string | null;
  topics: TopicRow[];
};

export function DenemeWrongTopicsChecklist({ subjectId, topics }: Props) {
  if (!subjectId) {
    return (
      <p className="text-xs text-muted-foreground">
        Bu görevde ders bilgisi yok; yanlış konu işaretlenemez.
      </p>
    );
  }

  const list = topics
    .filter((t) => t.subject_id === subjectId)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (list.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Bu ders için müfredatta konu bulunamadı.
      </p>
    );
  }

  return (
    <fieldset className="space-y-2 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">
        Yanlış yaptığın konular
      </legend>
      <p className="text-xs text-muted-foreground">
        İsteğe bağlı. İşaretlediklerin öğretmen panelindeki konu eksikleri
        listesine eklenir.
      </p>
      <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-2">
        {list.map((t) => (
          <label
            key={t.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/60"
          >
            <input
              type="checkbox"
              name="deneme_wrong_topic_id"
              value={t.id}
              className="size-4 shrink-0 rounded border-input"
            />
            <span className="leading-snug">{t.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
