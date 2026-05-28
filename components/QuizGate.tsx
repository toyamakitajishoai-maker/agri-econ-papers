"use client";

import { useEffect, useState } from "react";

import { hasAnswered } from "@/lib/quizStats";

type QuizGateProps = {
  paperId: string;
  /** クイズが存在しない記事では skip=true を渡してそのまま表示 */
  skip?: boolean;
  children: React.ReactNode;
};

/**
 * 本文を未回答時にブラーして覆う。
 * - SSR時は素直に children を出す（ハイドレーション不一致回避: blur は mount 後に判断）
 * - 回答済み or スキップ済みなら何もしない
 * - 「クイズをスキップ」リンクで強制解除
 */
export default function QuizGate({ paperId, skip, children }: QuizGateProps) {
  const [mounted, setMounted] = useState(false);
  const [answered, setAnswered] = useState(true);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAnswered(hasAnswered(paperId));

    function refresh() {
      setAnswered(hasAnswered(paperId));
    }
    window.addEventListener("quiz-stats:updated", refresh);
    return () => window.removeEventListener("quiz-stats:updated", refresh);
  }, [paperId]);

  if (skip || !mounted) return <>{children}</>;

  const locked = !answered && !skipped;

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
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-10">
          <p className="pointer-events-auto rounded-full border border-[#e8e4dc] bg-[#faf8f5]/95 px-4 py-2 text-xs text-[#6b726b] shadow-sm backdrop-blur-sm">
            上のクイズに答えると本文が表示されます。
            <button
              type="button"
              onClick={() => setSkipped(true)}
              className="ml-2 underline-offset-2 hover:text-[#2f4a3a] hover:underline"
            >
              スキップして読む
            </button>
          </p>
        </div>
      ) : null}
    </div>
  );
}
