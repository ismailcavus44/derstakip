"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const LINES = [
  "Bütün kelimeler rüzgârda eğilip bükülürken,",
  "Sen kutsal bir kitabın en başındaki o harf gibi dimdik, eşsiz ve tek...",
] as const;

/** İki satır arasındaki duraklama (ms); görsel boşluk yok, sadece zamanlama */
const BETWEEN_LINES_MS = 700;

export function ElifimPoem() {
  const [started, setStarted] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [charInLine, setCharInLine] = useState(0);

  useEffect(() => {
    if (!started) return;
    if (lineIndex >= LINES.length) return;

    const line = LINES[lineIndex];

    if (charInLine < line.length) {
      const id = window.setTimeout(() => {
        setCharInLine((c) => c + 1);
      }, 34);
      return () => window.clearTimeout(id);
    }

    if (lineIndex < LINES.length - 1) {
      const id = window.setTimeout(() => {
        setLineIndex((i) => i + 1);
        setCharInLine(0);
      }, BETWEEN_LINES_MS);
      return () => window.clearTimeout(id);
    }
  }, [started, lineIndex, charInLine]);

  return (
    <div className="flex w-full max-w-[min(96vw,28rem)] flex-col items-center gap-4 px-1">
      {!started ? (
        <Button
          type="button"
          size="lg"
          className="h-11 rounded-full border-0 bg-gradient-to-r from-pink-500 to-rose-500 px-8 text-base font-semibold text-white shadow-[0_8px_28px_-6px_rgba(244,114,182,0.65)] transition-[transform,box-shadow] hover:from-pink-500 hover:to-rose-500 hover:shadow-[0_12px_36px_-8px_rgba(244,114,182,0.75)] active:scale-[0.98] sm:h-12 sm:px-10 sm:text-lg"
          onClick={() => setStarted(true)}
        >
          Bana tıkla Elifim
        </Button>
      ) : (
        <div
          className="flex w-full flex-col gap-3 text-balance text-left"
          aria-live="polite"
        >
          {LINES.slice(0, lineIndex).map((l, i) => (
            <p
              key={i}
              className="m-0 text-base leading-normal text-foreground/95 sm:text-lg"
            >
              {l}
            </p>
          ))}
          {lineIndex < LINES.length && (
            <p className="m-0 text-base leading-normal text-foreground/95 sm:text-lg">
              {LINES[lineIndex].slice(0, charInLine)}
              <span
                className="ml-0.5 inline-block h-[1.05em] w-px animate-pulse bg-pink-500 align-text-bottom opacity-90"
                aria-hidden
              />
            </p>
          )}
        </div>
      )}
    </div>
  );
}
