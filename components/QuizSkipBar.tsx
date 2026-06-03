"use client";

import { useCallback, useEffect, useState } from "react";

import {
  isPaperReadUnlocked,
  markPaperRead,
  PAPER_READ_UPDATED,
} from "@/lib/paperReadState";
import { hasAnswered } from "@/lib/quizStats";

type QuizSkipBarProps = {
  paperId: string;
};

export default function QuizSkipBar({ paperId }: QuizSkipBarProps) {
  const [hidden, setHidden] = useState(false);

  const refresh = useCallback(() => {
    setHidden(isPaperReadUnlocked(paperId) || hasAnswered(paperId));
  }, [paperId]);

  useEffect(() => {
    refresh();
    window.addEventListener("quiz-stats:updated", refresh);
    window.addEventListener(PAPER_READ_UPDATED, refresh);
    return () => {
      window.removeEventListener("quiz-stats:updated", refresh);
      window.removeEventListener(PAPER_READ_UPDATED, refresh);
    };
  }, [refresh]);

  if (hidden) return null;

  function handleSkip() {
    markPaperRead(paperId);
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#d8d2c4] bg-[#faf8f5] px-4 py-4">
      <p className="text-center text-xs text-[#8a908a]">今日は急いでいる方はこちら</p>
      <button
        type="button"
        onClick={handleSkip}
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2f4a3a] bg-white px-5 py-2.5 text-sm font-semibold text-[#2f4a3a] shadow-sm transition hover:bg-[#eef3ee]"
      >
        スキップして読む
        <span aria-hidden className="text-base leading-none">
          →
        </span>
      </button>
    </div>
  );
}
