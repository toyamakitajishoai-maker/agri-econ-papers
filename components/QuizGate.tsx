"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  isPaperReadUnlocked,
  markPaperRead,
  PAPER_READ_UPDATED,
} from "@/lib/paperReadState";
import { hasAnswered } from "@/lib/quizStats";

type QuizGateProps = {
  paperId: string;
  /** クイズが存在しない記事では skip=true を渡してそのまま表示 */
  skip?: boolean;
  children: React.ReactNode;
};

/**
 * クイズ回答・スキップまで本文を折りたたみ表示（ブラーなし）。
 */
export default function QuizGate({ paperId, skip, children }: QuizGateProps) {
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const refresh = useCallback(() => {
    setUnlocked(isPaperReadUnlocked(paperId) || hasAnswered(paperId));
  }, [paperId]);

  useEffect(() => {
    setMounted(true);
    refresh();

    function onStatsUpdate() {
      refresh();
      if (hasAnswered(paperId)) markPaperRead(paperId);
    }

    function onPaperRead(e: Event) {
      const detail = (e as CustomEvent<{ paperId?: string }>).detail;
      if (!detail?.paperId || detail.paperId === paperId) refresh();
    }

    window.addEventListener("quiz-stats:updated", onStatsUpdate);
    window.addEventListener(PAPER_READ_UPDATED, onPaperRead);
    return () => {
      window.removeEventListener("quiz-stats:updated", onStatsUpdate);
      window.removeEventListener(PAPER_READ_UPDATED, onPaperRead);
    };
  }, [paperId, refresh]);

  const wasLockedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!mounted || skip) return;
    const locked = !unlocked;
    if (wasLockedRef.current && !locked) {
      const el = document.getElementById("article-content");
      if (el) {
        const t = window.setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
        return () => window.clearTimeout(t);
      }
    }
    wasLockedRef.current = locked;
  }, [mounted, unlocked, skip]);

  if (skip) return <>{children}</>;

  const locked = !mounted || !unlocked;

  if (!locked) {
    return (
      <div id="article-content" className="scroll-mt-24 animate-[fadeIn_0.35s_ease-out]">
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-2xl border border-[#ebe7df] bg-white/60"
        aria-hidden
      >
        <div className="pointer-events-none max-h-[min(42vh,320px)] select-none opacity-40">
          {children}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#faf8f5] via-[#faf8f5]/90 to-transparent"
          aria-hidden
        />
      </div>
      <p className="rounded-2xl border border-[#e8e4dc] bg-[#faf8f5] px-5 py-4 text-center text-sm leading-relaxed text-[#5c635c]">
        上のクイズに答えるか、「スキップして読む」を押すと、本文が読めるようになります。
      </p>
    </div>
  );
}
