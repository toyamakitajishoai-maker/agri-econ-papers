"use client";

import { Check, ChevronLeft, ChevronRight, Copy, Download, Images } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import {
  downloadStoryCanvas,
  drawStoryCardToCanvas,
} from "@/lib/storyCardCanvas";
import {
  buildStoryShareCaption,
  STORY_BRAND,
  STORY_SLIDES,
} from "@/lib/storyCardTheme";
import type { StoryCards } from "@/lib/types";

type StoryCardsProps = {
  cards: StoryCards;
  catchTitle: string;
  /** シェア用パス（例: /papers/2605.26508） */
  sharePath?: string;
};

export default function StoryCardsSection({
  cards,
  catchTitle,
  sharePath = "",
}: StoryCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined" && sharePath
      ? `${window.location.origin}${sharePath}`
      : sharePath;

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
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

  function renderCanvas(slideIndex: number) {
    const slide = STORY_SLIDES[slideIndex];
    if (!slide) return null;
    return drawStoryCardToCanvas({
      slide,
      catchTitle,
      body: cards[slide.key],
      sharePath: sharePath || window.location.pathname,
    });
  }

  async function saveCurrentCard() {
    const slide = STORY_SLIDES[active];
    if (!slide) return;
    setSaving(true);
    try {
      const canvas = renderCanvas(active);
      if (!canvas) return;
      await downloadStoryCanvas(canvas, `story-${slide.label}-${active + 1}.png`);
    } finally {
      setSaving(false);
    }
  }

  async function saveAllCards() {
    setSavingAll(true);
    try {
      for (let i = 0; i < STORY_SLIDES.length; i += 1) {
        const slide = STORY_SLIDES[i];
        const canvas = renderCanvas(i);
        if (!canvas || !slide) continue;
        await downloadStoryCanvas(canvas, `story-${slide.label}-${i + 1}.png`);
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally {
      setSavingAll(false);
    }
  }

  async function copyShareCaption() {
    const caption = buildStoryShareCaption(catchTitle, cards, shareUrl || sharePath);
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard 不可環境は無視 */
    }
  }

  const busy = saving || savingAll;

  return (
    <section className="rounded-2xl border border-[#e8e4dc] bg-[#fffdf8] px-4 py-5 sm:px-5">
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a8460]">
            4枚で読む
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#5c635c]">
            保存前に、この場で4枚の中身を確認できます。ストーリーズやX用の縦型画像として保存できます。
          </p>
          <p className="mt-1 text-[11px] text-[#8a908a]">
            推奨: Instagram ストーリーズ（9:16）・ X の画像投稿
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:max-w-[240px] sm:justify-end">
          <button
            type="button"
            onClick={copyShareCaption}
            className="inline-flex items-center gap-1 rounded-full border border-[#d8d2c4] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3830] transition hover:bg-[#faf7f0]"
          >
            {copied ? (
              <Check className="h-3 w-3 text-[#2f4a3a]" strokeWidth={2.5} />
            ) : (
              <Copy className="h-3 w-3" strokeWidth={2} />
            )}
            {copied ? "コピー済" : "投稿文"}
          </button>
          <button
            type="button"
            onClick={saveCurrentCard}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-[#d8d2c4] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3830] transition hover:bg-[#faf7f0] disabled:opacity-60"
          >
            <Download className="h-3 w-3" strokeWidth={2} />
            {saving ? "保存中…" : "1枚保存"}
          </button>
          <button
            type="button"
            onClick={saveAllCards}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-[#2f4a3a] bg-[#2f4a3a] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#3d5c4a] disabled:opacity-60"
          >
            <Images className="h-3 w-3" strokeWidth={2} />
            {savingAll ? "4枚保存中…" : "4枚まとめて"}
          </button>
        </div>
      </div>

      <div className="relative mt-5">
        <button
          type="button"
          aria-label="前のカード"
          onClick={() => scrollToIndex(Math.max(0, active - 1))}
          className="absolute -left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-[#e8e4dc] bg-white/95 p-2 shadow-md transition hover:bg-white sm:inline-flex"
          disabled={active <= 0}
        >
          <ChevronLeft className="h-4 w-4 text-[#3d3830]" />
        </button>
        <button
          type="button"
          aria-label="次のカード"
          onClick={() => scrollToIndex(Math.min(STORY_SLIDES.length - 1, active + 1))}
          className="absolute -right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-[#e8e4dc] bg-white/95 p-2 shadow-md transition hover:bg-white sm:inline-flex"
          disabled={active >= STORY_SLIDES.length - 1}
        >
          <ChevronRight className="h-4 w-4 text-[#3d3830]" />
        </button>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-label="4枚図解カード（SNS用）"
        >
          {STORY_SLIDES.map((slide) => (
            <article
              key={slide.key}
              data-story-card
              className="relative w-[min(72vw,280px)] shrink-0 snap-center overflow-hidden rounded-[1.35rem] border border-[#e8e4dc] shadow-[0_8px_32px_rgba(26,31,28,0.08)]"
              style={{ aspectRatio: "9 / 16" }}
            >
              {/* 背景 */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, #fffdf8 0%, #faf8f5 55%, ${slide.accentMuted} 100%)`,
                }}
              />
              <div
                className="absolute left-0 right-0 top-0 h-1"
                style={{ backgroundColor: slide.accent }}
              />

              {/* 透かし番号 */}
              <span
                className="pointer-events-none absolute right-3 top-14 select-none font-sans text-[5.5rem] font-extrabold leading-none opacity-[0.14]"
                style={{ color: slide.accent }}
                aria-hidden
              >
                {String(slide.index + 1).padStart(2, "0")}
              </span>

              <div className="relative flex h-full flex-col px-4 pb-4 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold tracking-wide text-[#9a8460]">
                    {STORY_BRAND}
                  </span>
                  <span className="text-[10px] tabular-nums text-[#8a908a]">
                    {slide.index + 1}/4
                  </span>
                </div>

                <p className="mt-2 font-serif text-[13px] font-semibold leading-snug text-[#1a1f1c] line-clamp-2">
                  {catchTitle}
                </p>

                <span
                  className="mt-3 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: slide.chipBg, color: slide.chipText }}
                >
                  <span aria-hidden>{slide.icon}</span>
                  {slide.label}
                </span>

                <p className="mt-4 flex-1 text-[15px] font-medium leading-[1.75] text-[#1a1f1c]">
                  {cards[slide.key]}
                </p>

                <div className="mt-auto rounded-xl border border-[#e8e4dc]/80 bg-white/90 px-3 py-2 backdrop-blur-sm">
                  <p className="text-[9px] leading-snug text-[#8a908a]">
                    画像保存 → ストーリーズ / X
                  </p>
                  {sharePath ? (
                    <p
                      className="mt-0.5 truncate text-[10px] font-medium"
                      style={{ color: slide.accent }}
                    >
                      {sharePath}
                    </p>
                  ) : null}
                </div>

                <div className="mt-2 flex justify-center gap-1">
                  {STORY_SLIDES.map((s) => (
                    <span
                      key={`dot-${s.key}`}
                      className="rounded-full transition-all"
                      style={{
                        width: s.index === slide.index ? 16 : 6,
                        height: 6,
                        backgroundColor: s.index === slide.index ? slide.accent : "#d8d2c4",
                      }}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="カード位置">
        {STORY_SLIDES.map((slide, i) => (
          <button
            key={slide.key}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`${slide.label}（${i + 1}枚目）`}
            onClick={() => scrollToIndex(i)}
            className="h-1.5 rounded-full transition-all duration-200"
            style={{
              width: i === active ? 24 : 6,
              backgroundColor: i === active ? STORY_SLIDES[active]?.accent ?? "#9a8460" : "#d8d2c4",
            }}
          />
        ))}
      </div>
    </section>
  );
}
