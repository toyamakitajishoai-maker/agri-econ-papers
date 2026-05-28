/**
 * 全データを走査してタグごとの論文リストを返すサーバー専用ヘルパ。
 * /tags/[slug] と /tags（一覧）で使う。
 */
import { tagToSlug } from "@/lib/categoryMap";
import { getAvailableDates, getDailyPapers } from "@/lib/data";
import { getTags } from "@/lib/editorial";
import type { Paper } from "@/lib/types";

import { readdir } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

async function listAllDates(): Promise<string[]> {
  const fromIndex = await getAvailableDates();
  let fromDisk: string[] = [];
  try {
    fromDisk = (await readdir(DATA_DIR))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    fromDisk = [];
  }
  return [...new Set([...fromIndex, ...fromDisk])].sort((a, b) => b.localeCompare(a));
}

export type TaggedPaper = { paper: Paper; date: string };

/** すべての論文をフラットに（新しい順） */
export async function getAllPapers(): Promise<TaggedPaper[]> {
  const dates = await listAllDates();
  const out: TaggedPaper[] = [];
  for (const date of dates) {
    const papers = await getDailyPapers(date);
    for (const paper of papers) out.push({ paper, date });
  }
  return out;
}

/** slug にマッチする論文のみ抜き出す */
export async function getPapersByTagSlug(slug: string): Promise<{
  matchedTag: string | null;
  papers: TaggedPaper[];
}> {
  const all = await getAllPapers();
  let matchedTag: string | null = null;
  const result: TaggedPaper[] = [];
  for (const item of all) {
    const tags = getTags(item.paper);
    const hit = tags.find((t) => tagToSlug(t) === slug);
    if (hit) {
      if (!matchedTag) matchedTag = hit;
      result.push(item);
    }
  }
  return { matchedTag, papers: result };
}

/** タグ一覧（出現回数つき、回数の多い順） */
export async function getAllTagsWithCount(): Promise<Array<{ tag: string; count: number }>> {
  const all = await getAllPapers();
  const counts = new Map<string, number>();
  for (const item of all) {
    const tags = getTags(item.paper);
    for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
