"use client";

import { useEffect, useState } from "react";

import { markPaperRead } from "@/lib/paperReadState";
import { readStats, recordAnswer } from "@/lib/quizStats";
import type { PredictionQuiz as PredictionQuizType } from "@/lib/types";

type PredictionQuizProps = {
  quiz: PredictionQuizType;
  paperId: string;
  field?: string;
};

function getOptionFeedback(quiz: PredictionQuizType, index: number): string {
  const custom = quiz.optionExplanations?.[index]?.trim();
  if (custom) return custom;
  if (index === quiz.correctIndex) {
    return quiz.explanation;
  }
  return "惜しい！ この研究の主な特徴とは少し違う考え方です。本文を読むと、なぜ別の選択肢になるかが分かります。";
}

export default function PredictionQuiz({ quiz, paperId, field }: PredictionQuizProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const options = quiz.options.slice(0, 3);
  const answered = picked !== null;
  const correct = picked === quiz.correctIndex;

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
    markPaperRead(paperId);
  }

  const feedback = picked !== null ? getOptionFeedback(quiz, picked) : "";

  return (
    <section className="rounded-2xl border border-[#e8e4dc] bg-white px-5 py-6 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:px-6">
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
              <span className="mr-2 font-semibold text-[#6b7f6b]">
                {String.fromCharCode(65 + index)}.
              </span>
              {option}
            </button>
          );
        })}
      </div>

      {answered && picked !== null ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            correct ? "bg-[#eef3ee] text-[#2f4a3a]" : "bg-[#fdf5f3] text-[#6b3d35]"
          }`}
        >
          <p className="font-medium">
            {correct ? "正解です！" : "惜しい！"}
          </p>
          <p className="mt-1">{feedback}</p>
          {!correct ? (
            <p className="mt-2 text-xs text-[#8a908a]">
              ヒント: 正解は{" "}
              <span className="font-semibold text-[#2f4a3a]">
                {String.fromCharCode(65 + quiz.correctIndex)}
              </span>
              です。本文を読むと理由が分かります。
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
