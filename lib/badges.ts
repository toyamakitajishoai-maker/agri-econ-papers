/**
 * 称号定義。煽らない上品な文言で、淡々と達成を記録する。
 */
import { currentStreak, fieldsRead, totalCorrect, totalRead } from "@/lib/quizStats";
import type { QuizStats } from "@/lib/quizStats";

export type Badge = {
  id: string;
  label: string;
  description: string;
  /** その称号の達成判定。達成済みなら true */
  achieved: (stats: QuizStats) => boolean;
  /** 達成までの進捗（0〜1）と現在値・目標値 */
  progress: (stats: QuizStats) => { ratio: number; current: number; goal: number };
};

export const BADGES: Badge[] = [
  {
    id: "first-step",
    label: "はじめての一歩",
    description: "1本の研究を読み終えた方に。",
    achieved: (s) => totalRead(s) >= 1,
    progress: (s) => {
      const c = totalRead(s);
      return { ratio: Math.min(1, c / 1), current: c, goal: 1 };
    },
  },
  {
    id: "reader-10",
    label: "読み手としての習慣",
    description: "10本の研究に目を通した方に。",
    achieved: (s) => totalRead(s) >= 10,
    progress: (s) => {
      const c = totalRead(s);
      return { ratio: Math.min(1, c / 10), current: c, goal: 10 };
    },
  },
  {
    id: "reader-50",
    label: "常連の読み手",
    description: "50本の研究を読み重ねた方に。",
    achieved: (s) => totalRead(s) >= 50,
    progress: (s) => {
      const c = totalRead(s);
      return { ratio: Math.min(1, c / 50), current: c, goal: 50 };
    },
  },
  {
    id: "cross-3",
    label: "分野をまたぐ人",
    description: "3つの異なる分野の研究に触れた方に。",
    achieved: (s) => fieldsRead(s).length >= 3,
    progress: (s) => {
      const c = fieldsRead(s).length;
      return { ratio: Math.min(1, c / 3), current: c, goal: 3 };
    },
  },
  {
    id: "streak-7",
    label: "学び続ける人",
    description: "クイズに7日続けて答えた方に。",
    achieved: (s) => currentStreak(s) >= 7,
    progress: (s) => {
      const c = currentStreak(s);
      return { ratio: Math.min(1, c / 7), current: c, goal: 7 };
    },
  },
];

export type Kpi = {
  totalRead: number;
  totalAnswered: number;
  totalCorrect: number;
  accuracy: number;
  streak: number;
  fields: number;
};

export function computeKpi(stats: QuizStats): Kpi {
  const answered = Object.keys(stats.answers).length;
  const correct = totalCorrect(stats);
  return {
    totalRead: totalRead(stats),
    totalAnswered: answered,
    totalCorrect: correct,
    accuracy: answered > 0 ? correct / answered : 0,
    streak: currentStreak(stats),
    fields: fieldsRead(stats).length,
  };
}

export function computeFieldDistribution(stats: QuizStats): Array<{ field: string; count: number }> {
  const map = stats.readByField ?? {};
  return Object.entries(map)
    .filter(([, n]) => n > 0)
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count);
}
