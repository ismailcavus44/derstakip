"use client";

import { useCallback, useId, useState } from "react";

const SOURCES = ["/elifim.jpeg", "/elifim.jpg", "/elifim.png", "/elifim.webp"] as const;

/** viewBox 0 0 100 100 — objectBoundingBox yerine doğrudan SVG koordinatları */
const HEART_D =
  "M50 88 C18 54 5 40 5 26 C5 12 18 2 32 2 C42 2 50 12 50 20 C50 12 58 2 68 2 C82 2 95 12 95 26 C95 40 82 54 50 88 Z";

export function ElifimHeart() {
  const reactId = useId().replace(/:/g, "");
  const gradId = `elifim-grad-${reactId}`;
  const clipFullId = `elifim-clip-full-${reactId}`;

  const [index, setIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const src = SOURCES[index] ?? SOURCES[0];

  const onImageError = useCallback(() => {
    setIndex((current) => {
      if (current + 1 < SOURCES.length) return current + 1;
      setAllFailed(true);
      return current;
    });
  }, []);

  return (
    <svg
      viewBox="0 0 100 100"
      className="mx-auto w-[min(96vw,42rem)] max-w-full drop-shadow-[0_12px_40px_rgba(244,114,182,0.45)]"
      role="img"
      aria-label="Elifim fotoğrafı, pembe kalp içinde"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="45%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#fb7185" />
        </linearGradient>
        <clipPath id={clipFullId} clipPathUnits="userSpaceOnUse">
          <path d={HEART_D} />
        </clipPath>
      </defs>

      {/* Pembe kalp */}
      <path d={HEART_D} fill={`url(#${gradId})`} />

      {/*
        Fotoğraf 100×100 kutuda meet ile sığdırılır; sonra merkezden küçültülür ki
        dikdörtgen sınırı kalp içinde kalsın — tam görüntü görünür, kalp köşeleri kesmez.
      */}
      <g clipPath={`url(#${clipFullId})`}>
        <g transform="translate(50 54) scale(0.54) translate(-50 -54)">
          <image
            key={src}
            href={src}
            x="0"
            y="0"
            width="100"
            height="100"
            preserveAspectRatio="xMidYMid meet"
            onError={onImageError}
          />
        </g>
      </g>

      {allFailed && (
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.95)"
          className="select-none"
          style={{ fontSize: "3.2px", fontWeight: 600 }}
        >
          Foto yok: public/elifim.jpeg veya .jpg
        </text>
      )}
    </svg>
  );
}
