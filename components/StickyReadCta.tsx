"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { isPaperReadUnlocked, PAPER_READ_UPDATED } from "@/lib/paperReadState";
import { hasAnswered } from "@/lib/quizStats";

type StickyReadCtaProps = {
  paperId: string;
  /** クイズが無い記事では true */
  skipGate?: boolean;
  label?: string;
};

export default function StickyReadCta({
  paperId,
  skipGate = false,
  label = "本文を読む",
}: StickyReadCtaProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (skipGate) {
      setVisible(false);
      return;
    }
    function refresh() {
      setVisible(!(isPaperReadUnlocked(paperId) || hasAnswered(paperId)));
    }
    refresh();
    window.addEventListener("quiz-stats:updated", refresh);
    window.addEventListener(PAPER_READ_UPDATED, refresh);
    return () => {
      window.removeEventListener("quiz-stats:updated", refresh);
      window.removeEventListener(PAPER_READ_UPDATED, refresh);
    };
  }, [paperId, skipGate]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
      <Link
        href="#read-body"
        className="pointer-events-auto flex w-full items-center justify-center rounded-full bg-[#2f4a3a] px-6 py-3.5 text-sm font-medium text-white shadow-[0_4px_24px_rgba(47,74,58,0.35)]"
      >
        {label}
      </Link>
    </div>
  );
}
