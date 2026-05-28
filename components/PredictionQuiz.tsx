"use client";

import { useEffect, useState } from "react";

import { readStats, recordAnswer } from "@/lib/quizStats";
import type { PredictionQuiz as PredictionQuizType } from "@/lib/types";

type PredictionQuizProps = {
  quiz: PredictionQuizType;
  paperId: string;
  field?: string;
};

export default function PredictionQuiz({ quiz, paperId, field }: PredictionQuizProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const options = quiz.options.slice(0, 3);
  const answered = picked !== null;
  const correct = picked === quiz.correctIndex;

  /** マウント時に既回答があれば復元（リロード後も結果表示を維持） */
  useEffect(() => {
    const prev = readStats().answers[paperId];
    if (prev) setPicked(prev.picked);
  }, [paperId]);

  function handlePick(index: number) {
    if (answered) return;
    setPicked(index);
    recordAnswer({
      paperId,
      picked: index,
      correctIndex: quiz.correctIndex,
      field,
      difficulty: quiz.difficulty,
    });
  }

  return (
    <section className="rounded-3xl border-2 border-dashed border-[#d4c4a8] bg-gradient-to-br from-[#fffdf8] to-[#f5f0e6] px-5 py-6 sm:px-7">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a8460]">
        予想クイズ
      </p>
      <p className="mt-2 font-serif text-lg font-semibold leading-snug text-[#1a1f1c]">
        {quiz.question}
      </p>
      <p className="mt-1 text-xs text-[#8a908a]">答えを選んでから、本文を読み進めてみてください。</p>

      <div className="mt-5 grid gap-2 sm:grid-cols-1">
        {options.map((option, index) => {
          const isPicked = picked === index;
          const isCorrectOption = index === quiz.correctIndex;
          let ring = "border-[#ebe7df] bg-white hover:border-[#9a8460]";
          if (answered && isPicked && isCorrectOption) {
            ring = "border-[#2f4a3a] bg-[#eef3ee]";
          } else if (answered && isPicked && !isCorrectOption) {
            ring = "border-[#c45c4a] bg-[#fdf5f3]";
          } else if (answered && isCorrectOption) {
            ring = "border-[#2f4a3a] bg-[#f0f7f2]";
          }

          return (
            <button
              key={`opt-${index}`}
              type="button"
              disabled={answered}
              onClick={() => handlePick(index)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition ${ring} ${
                answered ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <span className="mr-2 font-semibold text-[#6b7f6b]">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            correct ? "bg-[#eef3ee] text-[#2f4a3a]" : "bg-[#fdf5f3] text-[#6b3d35]"
          }`}
        >
          <p className="font-medium">{correct ? "正解です" : "惜しい！正解は別の選択肢です"}</p>
          <p className="mt-1">{quiz.explanation}</p>
        </div>
      ) : null}
    </section>
  );
}
