"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { currentStreak, readStats } from "@/lib/quizStats";

/**
 * ヘッダー右上に常駐するクイズストリーク。
 * SSR では空（プレースホルダのみ）を返してハイドレーション不一致を回避し、
 * mount 後に LocalStorage を読んで実値を表示する。
 */
export default function StreakBadge() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    function refresh() {
      const stats = readStats();
      setStreak(currentStreak(stats));
    }
    refresh();
    window.addEventListener("quiz-stats:updated", refresh);
    /** 他タブで更新された場合にも反映 */
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("quiz-stats:updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  /** SSR & マウント直後: 高さだけ確保した空 span（レイアウト揺れ防止） */
  if (streak === null) {
    return <span aria-hidden className="inline-block h-6 w-12" />;
  }

  if (streak <= 0) {
    return (
      <Link
        href="/me"
        className="inline-flex items-center gap-1 rounded-full border border-[#e8e4dc] bg-white/70 px-2.5 py-1 text-[11px] text-[#8a908a] transition hover:border-[#d8d2c4] hover:text-[#3d3830]"
        title="クイズに答えると連続日数が始まります（タップでマイページへ）"
      >
        <Flame className="h-3 w-3" strokeWidth={1.8} />
        ストリーク 0
      </Link>
    );
  }

  return (
    <Link
      href="/me"
      className="inline-flex items-center gap-1 rounded-full border border-[#e8d6c8] bg-[#fdf3ec] px-2.5 py-1 text-[11px] font-medium text-[#3d3830] transition hover:border-[#d8b8a3] hover:bg-[#fae8db]"
      title={`クイズに答えた日数：${streak}日連続（タップでマイページへ）`}
    >
      <Flame
        className="h-3 w-3 text-[#c45c4a]"
        strokeWidth={2}
        fill="#e8826a"
        aria-hidden
      />
      {streak}日連続
    </Link>
  );
}
