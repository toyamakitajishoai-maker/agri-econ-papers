"use client";

import { useCallback, useEffect, useState } from "react";

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
 * 「まずここだけ」以降の本文を、未解除時のみブラー。
 * 解除条件: クイズ回答済み or スキップ済み（paper-read-*、30日有効）
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

  if (skip || !mounted) return <>{children}</>;

  const locked = !unlocked;

  return (
    <div className="relative">
      <div
        className={
          locked
            ? "pointer-events-none select-none blur-sm transition duration-200"
            : "transition-opacity duration-200 ease-out animate-[fadeIn_0.2s_ease-out]"
        }
        aria-hidden={locked}
      >
        {children}
      </div>
      {locked ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-start justify-center pt-12"
          aria-live="polite"
        >
          <p className="max-w-[min(100%,20rem)] rounded-2xl border border-[#e8e4dc] bg-[#faf8f5]/95 px-5 py-3 text-center text-xs leading-relaxed text-[#6b726b] shadow-sm backdrop-blur-sm">
            上のクイズに答えると、ここから先の本文が表示されます。
          </p>
        </div>
      ) : null}
    </div>
  );
}
