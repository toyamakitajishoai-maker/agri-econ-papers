import type { Paper } from "@/lib/types";

const ARXIV_FALLBACK = "arXiv（プレプリント）";
const UNKNOWN_FALLBACK = "掲載誌情報なし";

/** 画面表示用の掲載誌名 */
export function getJournalLabel(paper: Paper): string {
  const name = paper.journal?.trim();
  if (name) return name;
  if (paper.source === "arxiv") return ARXIV_FALLBACK;
  return UNKNOWN_FALLBACK;
}

export type JournalCount = {
  name: string;
  count: number;
};

/** 一覧に含まれる掲載誌を件数付きで集計（件数の多い順） */
export function collectJournalCounts(papers: Paper[]): JournalCount[] {
  const map = new Map<string, number>();

  for (const paper of papers) {
    const label = getJournalLabel(paper);
    map.set(label, (map.get(label) ?? 0) + 1);
  }

  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}
