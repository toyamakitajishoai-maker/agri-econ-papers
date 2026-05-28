"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import type { StoryCards } from "@/lib/types";

type StoryCardsProps = {
  cards: StoryCards;
  catchTitle: string;
};

const SLIDES: Array<{ key: keyof StoryCards; label: string; index: number }> = [
  { key: "ask", label: "問い", index: 0 },
  { key: "method", label: "手法", index: 1 },
  { key: "finding", label: "発見", index: 2 },
  { key: "meaning", label: "意味", index: 3 },
];

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCardToCanvas(
  catchTitle: string,
  label: string,
  body: string,
  step: string
): HTMLCanvasElement {
  const w = 1080;
  const h = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#faf8f5";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#e8e4dc";
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, w - 96, h - 96);

  ctx.fillStyle = "#9a8460";
  ctx.font = "600 36px system-ui, sans-serif";
  ctx.fillText("今日の研究、3分で。", 80, 120);

  ctx.fillStyle = "#8a908a";
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillText(step, w - 180, 120);

  ctx.fillStyle = "#2f4a3a";
  ctx.font = "600 32px system-ui, sans-serif";
  const titleLines = wrapCanvasLines(ctx, catchTitle, w - 160);
  let y = 200;
  for (const tl of titleLines.slice(0, 2)) {
    ctx.fillText(tl, 80, y);
    y += 44;
  }

  ctx.fillStyle = "#f2ebd9";
  const chipW = ctx.measureText(label).width + 48;
  ctx.beginPath();
  ctx.roundRect(80, y + 16, chipW, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#7c6a45";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText(label, 104, y + 52);

  y += 100;
  ctx.fillStyle = "#1a1f1c";
  ctx.font = "500 42px system-ui, sans-serif";
  const bodyLines = wrapCanvasLines(ctx, body, w - 160);
  for (const bl of bodyLines.slice(0, 14)) {
    ctx.fillText(bl, 80, y);
    y += 58;
  }

  return canvas;
}

export default function StoryCardsSection({ cards, catchTitle }: StoryCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      setActive(index);
    }
  }, []);

  function onScroll() {
    const el = scrollRef.current;
    if (!el || el.children.length === 0) return;
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < el.children.length; i += 1) {
      const c = el.children[i] as HTMLElement;
      const cr = c.getBoundingClientRect();
      const dist = Math.abs(cr.left + cr.width / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setActive(best);
  }

  async function saveCurrentCard() {
    const slide = SLIDES[active];
    if (!slide) return;
    setSaving(true);
    try {
      const canvas = drawCardToCanvas(
        catchTitle,
        slide.label,
        cards[slide.key],
        `${slide.index + 1}/4`
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png", 0.92)
      );
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `story-${slide.label}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#e8e4dc] bg-[#fffdf8] px-4 py-5 sm:px-5">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a8460]">
            4枚で読む
          </p>
          <p className="mt-1 text-xs text-[#8a908a]">左右にスワイプ。会話のネタに。</p>
        </div>
        <button
          type="button"
          onClick={saveCurrentCard}
          disabled={saving}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d8d2c4] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3830] transition hover:bg-[#faf7f0] disabled:opacity-60"
        >
          <Download className="h-3 w-3" strokeWidth={2} />
          {saving ? "保存中…" : "画像で保存"}
        </button>
      </div>

      <div className="relative mt-4">
        <button
          type="button"
          aria-label="前のカード"
          onClick={() => scrollToIndex(Math.max(0, active - 1))}
          className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-[#e8e4dc] bg-white/90 p-1.5 shadow-sm transition hover:bg-white sm:inline-flex"
          disabled={active <= 0}
        >
          <ChevronLeft className="h-4 w-4 text-[#3d3830]" />
        </button>
        <button
          type="button"
          aria-label="次のカード"
          onClick={() => scrollToIndex(Math.min(SLIDES.length - 1, active + 1))}
          className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-[#e8e4dc] bg-white/90 p-1.5 shadow-sm transition hover:bg-white sm:inline-flex"
          disabled={active >= SLIDES.length - 1}
        >
          <ChevronRight className="h-4 w-4 text-[#3d3830]" />
        </button>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-label="4枚図解カード"
        >
          {SLIDES.map(({ key, label, index }) => (
            <article
              key={key}
              data-story-card
              className="min-h-[220px] w-[min(88vw,320px)] shrink-0 snap-center rounded-2xl border border-[#e8e4dc] bg-white px-5 py-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#f2ebd9] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#7c6a45]">
                  {label}
                </span>
                <span className="text-[11px] tabular-nums text-[#8a908a]">{index + 1}/4</span>
              </div>
              <p className="mt-5 font-serif text-lg font-semibold leading-snug text-[#1a1f1c] line-clamp-2">
                {catchTitle}
              </p>
              <p className="mt-4 text-sm leading-[1.9] text-[#3d4540]">{cards[key]}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="カード位置">
        {SLIDES.map(({ key, label }, i) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`${label}（${i + 1}枚目）`}
            onClick={() => scrollToIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === active ? "w-6 bg-[#9a8460]" : "w-1.5 bg-[#d8d2c4]"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
