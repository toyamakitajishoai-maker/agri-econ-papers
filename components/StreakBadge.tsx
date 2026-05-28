"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { currentStreak, readStats, totalAnswered } from "@/lib/quizStats";

const TOOLTIP =
  "毎日1本以上クイズに答えると連続記録が伸びます。0時を跨いで未回答の日があるとリセットされます。";

/**
 * ヘッダー右上の連続読了バッジ。
 */
export default function StreakBadge() {
  const [label, setLabel] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    function refresh() {
      const stats = readStats();
      const streak = currentStreak(stats);
      const everAnswered = totalAnswered(stats) > 0;

      if (!everAnswered) {
        setLabel("今日からスタート");
      } else if (streak > 0) {
        setLabel(`連続読了 ${streak}日`);
      } else {
        setLabel("連続を再開しよう");
      }
    }
    refresh();
    window.addEventListener("quiz-stats:updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("quiz-stats:updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (label === null) {
    return <span aria-hidden className="inline-block h-6 w-20" />;
  }

  const isWarm = label.includes("連続読了") && !label.includes("再開");

  return (
    <div className="relative inline-flex items-center gap-1">
      <Link
        href="/me"
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
          isWarm
            ? "border-[#e8d6c8] bg-[#fdf3ec] text-[#3d3830] hover:border-[#d8b8a3] hover:bg-[#fae8db]"
            : "border-[#e8e4dc] bg-white/70 text-[#6b726b] hover:border-[#d8d2c4] hover:text-[#3d3830]"
        }`}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
      >
        <Flame
          className={`h-3 w-3 ${isWarm ? "text-[#c45c4a]" : "text-[#9a8460]"}`}
          strokeWidth={2}
          fill={isWarm ? "#e8826a" : "none"}
          aria-hidden
        />
        {label}
      </Link>
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[#e8e4dc] bg-white text-[10px] font-semibold text-[#8a908a] transition hover:border-[#d8d2c4] hover:text-[#3d3830]"
        aria-label="連続読了の説明"
        aria-expanded={active}
        onClick={() => setActive((v) => !v)}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
      >
        ?
      </button>
      {active ? (
        <p
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-[#e8e4dc] bg-white px-3 py-2 text-[11px] leading-relaxed text-[#5c635c] shadow-md"
        >
          {TOOLTIP}
        </p>
      ) : null}
    </div>
  );
}
