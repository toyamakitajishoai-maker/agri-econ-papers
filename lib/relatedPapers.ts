/**
 * data/related.json を読み込み、指定 paperId に対する類似論文を返す。
 * サーバーサイドのみで使用（fs を直接読む）。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getAvailableDates, getDailyPapers } from "@/lib/data";
import type { Paper } from "@/lib/types";

const RELATED_PATH = path.join(process.cwd(), "data", "related.json");

type RelatedItem = { id: string; score: number };
type RelatedFile = {
  generatedAt?: string;
  model?: string;
  dimension?: number;
  related: Record<string, RelatedItem[]>;
};

let cache: RelatedFile | null = null;

async function loadRelated(): Promise<RelatedFile | null> {
  if (cache) return cache;
  try {
    const raw = await readFile(RELATED_PATH, "utf-8");
    cache = JSON.parse(raw) as RelatedFile;
    return cache;
  } catch {
    return null;
  }
}

let paperIndexCache: Map<string, Paper> | null = null;

async function buildPaperIndex(): Promise<Map<string, Paper>> {
  if (paperIndexCache) return paperIndexCache;
  const map = new Map<string, Paper>();
  const dates = await getAvailableDates();
  for (const date of dates) {
    const papers = await getDailyPapers(date);
    for (const p of papers) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
  }
  paperIndexCache = map;
  return map;
}

/**
 * paperId に対する関連論文（最大 3 件）を返す。
 * related.json が無い、または該当 ID が無い場合は同日他論文にフォールバック。
 */
export async function getRelatedPapers(
  paperId: string,
  fallback: Paper[] = []
): Promise<Paper[]> {
  const file = await loadRelated();
  const ids = file?.related?.[paperId];
  if (!ids || ids.length === 0) {
    return fallback.filter((p) => p.id !== paperId).slice(0, 3);
  }
  const index = await buildPaperIndex();
  const papers: Paper[] = [];
  for (const { id } of ids) {
    const p = index.get(id);
    if (p && p.id !== paperId) papers.push(p);
    if (papers.length >= 3) break;
  }
  // 補完が必要ならフォールバックを後ろに足す
  if (papers.length < 3) {
    for (const p of fallback) {
      if (p.id === paperId) continue;
      if (papers.find((x) => x.id === p.id)) continue;
      papers.push(p);
      if (papers.length >= 3) break;
    }
  }
  return papers.slice(0, 3);
}
