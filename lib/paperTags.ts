import { getTags } from "@/lib/editorial";
import type { Paper } from "@/lib/types";

const META_TAGS = new Set(["プレプリント", "査読論文", "今日の研究"]);

/** タグ集合（メタ除外） */
export function paperTagSet(paper: Paper): Set<string> {
  return new Set(getTags(paper).filter((t) => !META_TAGS.has(t)));
}

/** Jaccard 類似度 */
export function tagJaccard(a: Paper, b: Paper): number {
  const setA = paperTagSet(a);
  const setB = paperTagSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return inter / union;
}

/** 日付文字列 YYYY-MM-DD の差（日） */
export function daysBetweenDates(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T00:00:00+09:00`).getTime();
  const b = new Date(`${dateB}T00:00:00+09:00`).getTime();
  return Math.abs(Math.round((b - a) / 86_400_000));
}
