/**
 * data/related.json を読み込み、指定 paperId に対する類似論文を返す。
 * サーバーサイドのみで使用（fs を直接読む）。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getAvailableDates, getDailyPapers } from "@/lib/data";
import { getTags } from "@/lib/editorial";
import type { Paper } from "@/lib/types";

const META_TAGS = new Set(["プレプリント", "査読論文", "今日の研究"]);

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

/** タグの重なりが多い論文を新しい順に最大 limit 件 */
export async function getPapersBySharedTags(
  paper: Paper,
  limit = 3
): Promise<Paper[]> {
  const targetTags = new Set(
    getTags(paper).filter((t) => !META_TAGS.has(t))
  );
  if (targetTags.size === 0) return [];

  const index = await buildPaperIndex();
  const scored: { paper: Paper; score: number; published: number }[] = [];

  for (const p of index.values()) {
    if (p.id === paper.id) continue;
    const pTags = getTags(p).filter((t) => !META_TAGS.has(t));
    let score = 0;
    for (const t of pTags) {
      if (targetTags.has(t)) score += 1;
    }
    if (score === 0) continue;
    scored.push({
      paper: p,
      score,
      published: new Date(p.publishedAt).getTime() || 0,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.published - a.published);
  return scored.slice(0, limit).map((s) => s.paper);
}

/** 類似度ベース + タグマッチをマージ（重複除去、最大3件） */
export async function getMergedRelatedPapers(
  paper: Paper,
  fallback: Paper[] = []
): Promise<Paper[]> {
  const byTags = await getPapersBySharedTags(paper, 3);
  const byEmbed = await getRelatedPapers(paper.id, fallback);
  const seen = new Set<string>();
  const merged: Paper[] = [];

  for (const p of [...byTags, ...byEmbed]) {
    if (p.id === paper.id || seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
    if (merged.length >= 3) break;
  }
  return merged;
}
