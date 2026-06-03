/**
 * 関連論文: 全データからタグ Jaccard × 日付距離（7日以上優先）で上位3件。
 * embedding 類似度は補助的に利用。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getAvailableDates, getDailyPapers } from "@/lib/data";
import { resolvePaperSlot } from "@/lib/classifyPaper";
import { daysBetweenDates, tagJaccard } from "@/lib/paperTags";
import type { Paper } from "@/lib/types";

const RELATED_PATH = path.join(process.cwd(), "data", "related.json");
const MIN_DATE_GAP_DAYS = 7;

type RelatedItem = { id: string; score: number };
type RelatedFile = {
  related: Record<string, RelatedItem[]>;
};

let cache: RelatedFile | null = null;
let paperIndexCache: Map<string, Paper & { _date?: string }> | null = null;

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

async function buildPaperIndexWithDates(): Promise<
  Map<string, Paper & { _date?: string }>
> {
  if (paperIndexCache) return paperIndexCache;
  const map = new Map<string, Paper & { _date?: string }>();
  const dates = await getAvailableDates();
  for (const date of dates) {
    const papers = await getDailyPapers(date);
    for (const p of papers) {
      if (!map.has(p.id)) map.set(p.id, { ...p, _date: date });
    }
  }
  paperIndexCache = map;
  return map;
}

function resolvePaperDate(
  paper: Paper & { _date?: string },
  currentDate?: string
): string {
  if (paper._date) return paper._date;
  if (currentDate) return currentDate;
  return paper.publishedAt.slice(0, 10);
}

function abstractTokenSimilarity(a: string, b: string): number {
  const tokenize = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3)
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) {
    if (setB.has(w)) inter += 1;
  }
  return inter / (setA.size + setB.size - inter);
}

/**
 * 設計式: 0.5·Jaccard(tags) + 0.3·同 category_l2 + 0.2·abstract類似
 * かつ掲載日が7日以上離れた論文を優先（同日偏り回避）
 */
export async function getRelatedPapers(
  paper: Paper,
  currentDate?: string,
  limit = 3
): Promise<Paper[]> {
  const index = await buildPaperIndexWithDates();
  const dateOfCurrent = currentDate ?? resolvePaperDate(paper as Paper & { _date?: string });
  const slot = resolvePaperSlot(paper);
  const embedFile = await loadRelated();
  const embedList = embedFile?.related?.[paper.id] ?? [];
  const embedMax = embedList.reduce((m, x) => Math.max(m, x.score), 0) || 1;

  const scored: { paper: Paper; score: number }[] = [];

  for (const candidate of index.values()) {
    if (candidate.id === paper.id) continue;

    const candDate = resolvePaperDate(candidate, currentDate);
    const gap = daysBetweenDates(dateOfCurrent, candDate);
    if (gap < MIN_DATE_GAP_DAYS) continue;

    const jaccard = tagJaccard(paper, candidate);
    const l2Match = slot.categoryL2 === resolvePaperSlot(candidate).categoryL2 ? 1 : 0;
    const embedItem = embedList.find((e) => e.id === candidate.id);
    const embedSim = embedItem
      ? embedItem.score / embedMax
      : abstractTokenSimilarity(paper.abstract, candidate.abstract) * 0.5;

    const score = 0.5 * jaccard + 0.3 * l2Match + 0.2 * embedSim;
    if (score <= 0.08) continue;

    scored.push({ paper: candidate, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const out: Paper[] = [];
  for (const { paper: p } of scored) {
    if (out.find((x) => x.id === p.id)) continue;
    out.push(p);
    if (out.length >= limit) break;
  }

  return out;
}

/** 埋め込み類似度（related.json）を弱くブレンド */
export async function getEmbeddingRelatedIds(paperId: string): Promise<string[]> {
  const file = await loadRelated();
  return (file?.related?.[paperId] ?? []).map((x) => x.id);
}

export async function getMergedRelatedPapers(
  paper: Paper,
  currentDate?: string,
  siblings: Paper[] = []
): Promise<Paper[]> {
  const byTags = await getRelatedPapers(paper, currentDate, 3);
  const embedIds = await getEmbeddingRelatedIds(paper.id);
  const index = await buildPaperIndexWithDates();

  const seen = new Set<string>([paper.id]);
  const merged: Paper[] = [];

  for (const p of byTags) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
    if (merged.length >= 3) return merged;
  }

  for (const id of embedIds) {
    const p = index.get(id);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
    if (merged.length >= 3) return merged;
  }

  for (const p of siblings) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
    if (merged.length >= 3) break;
  }

  return merged;
}

/** @deprecated 旧 API 互換 */
export async function getPapersBySharedTags(paper: Paper, limit = 3): Promise<Paper[]> {
  return getRelatedPapers(paper, undefined, limit);
}
