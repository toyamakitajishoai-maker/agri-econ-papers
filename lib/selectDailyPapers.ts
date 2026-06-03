import type { ArxivPaper } from "@/lib/arxiv";
import { agriRelevanceScore, classifyPaper } from "@/lib/classifyPaper";
import { loadRecentCategoryL2Load, loadRecentCategoryLoad } from "@/lib/selectionHistory";
import type { CategoryL1 } from "@/lib/types";

export type ScoredCandidate = {
  paper: ArxivPaper;
  score: number;
  categoryL1: CategoryL1;
  categoryL2: string;
};

/** 1日5本のハードクォータ */
export const DAILY_QUOTA: Record<CategoryL1, number> = {
  "agri-econ": 2,
  adjacent: 2,
  serendipity: 1,
};

export type SelectionWeights = {
  w1_freshness: number;
  w2_impact: number;
  w3_readability: number;
  w4_category_load: number;
  w5_interest: number;
  w6_agri_relevance: number;
  w7_category_l2_load: number;
};

export const DEFAULT_WEIGHTS: SelectionWeights = {
  w1_freshness: 0.28,
  w2_impact: 0.1,
  w3_readability: 0.2,
  w4_category_load: 0.16,
  w5_interest: 0.08,
  w6_agri_relevance: 0.18,
  w7_category_l2_load: 0.12,
};

export type SelectionOptions = {
  /** PDF 検証前プールの最大件数 */
  maxPapers?: number;
  weights?: SelectionWeights;
  interestVector?: Partial<Record<CategoryL1, number>>;
  useInterestBoost?: boolean;
  todayDate?: string;
  now?: Date;
};

export type QuotaSelectionResult = {
  /** PDF 検証用の優先キュー（先頭からクォータ5本+予備） */
  ordered: ArxivPaper[];
  /** クォータどおりに選べた5本（シミュレーション用） */
  quotaPicks: ScoredCandidate[];
  warnings: string[];
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

export function abstractSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return inter / union;
}

function freshnessScore(publishedAt: string, now: Date): number {
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return 0.3;
  const days = (now.getTime() - t) / 86_400_000;
  if (days <= 1) return 1;
  if (days <= 3) return 0.85;
  if (days <= 7) return 0.65;
  if (days <= 30) return 0.4;
  return 0.2;
}

function impactScore(paper: ArxivPaper): number {
  const authors = paper.authors?.filter((a) => a.trim()).length ?? 0;
  const authorPart = Math.min(1, authors / 5);
  const abstractLen = paper.abstract?.length ?? 0;
  const lenPart = abstractLen >= 1200 ? 0.9 : abstractLen >= 600 ? 0.65 : 0.4;
  return 0.5 * authorPart + 0.5 * lenPart;
}

function readabilityScore(paper: ArxivPaper): number {
  const len = paper.abstract?.length ?? 0;
  if (len >= 400 && len <= 2500) return 1;
  if (len >= 200) return 0.7;
  return 0.35;
}

export function scoreCandidate(
  paper: ArxivPaper,
  ctx: {
    now: Date;
    categoryLoad: Partial<Record<CategoryL1, number>>;
    categoryL2Load: Record<string, number>;
    interestVector: Partial<Record<CategoryL1, number>>;
    weights: SelectionWeights;
    useInterestBoost: boolean;
  }
): ScoredCandidate {
  const classified = classifyPaper({
    categories: paper.categories,
    abstract: paper.abstract,
    title: paper.title,
    field: paper.field,
  });
  const l1 = classified.categoryL1;
  const l2 = classified.categoryL2;
  const w = ctx.weights;

  const fresh = freshnessScore(paper.publishedAt, ctx.now);
  const impact = impactScore(paper);
  const read = readabilityScore(paper);
  const loadPenalty = (ctx.categoryLoad[l1] ?? 0) * 0.12;
  const l2Penalty = (ctx.categoryL2Load[l2] ?? 0) * 0.15;
  const interestRaw = ctx.useInterestBoost ? (ctx.interestVector[l1] ?? 0) : 0;
  const interestNorm = interestRaw > 0 ? Math.min(1, interestRaw / 10) : 0;
  const agriBoost = agriRelevanceScore(paper.abstract, paper.title);

  const score =
    w.w1_freshness * fresh +
    w.w2_impact * impact +
    w.w3_readability * read -
    w.w4_category_load * loadPenalty -
    w.w7_category_l2_load * l2Penalty +
    w.w5_interest * interestNorm +
    w.w6_agri_relevance * agriBoost;

  return { paper, score, categoryL1: l1, categoryL2: l2 };
}

const L1_ORDER: CategoryL1[] = ["agri-econ", "adjacent", "serendipity"];

/**
 * 枠ごとに MMR で n 本選ぶ。同一 category_l2 は1日1本まで（ソフト制約）。
 */
function mmrPickSlot(
  pool: ScoredCandidate[],
  count: number,
  usedL2: Set<string>
): ScoredCandidate[] {
  const remaining = [...pool].sort((a, b) => b.score - a.score);
  const picked: ScoredCandidate[] = [];
  const lambda = 0.7;

  /** 同日は category_l2 を重複させない（ソフト。足りなければ緩和） */
  const canTake = (c: ScoredCandidate) => !usedL2.has(c.categoryL2);

  while (picked.length < count && remaining.length > 0) {
    if (picked.length === 0) {
      let firstIdx = remaining.findIndex((c) => canTake(c));
      if (firstIdx < 0) firstIdx = remaining.length > 0 ? 0 : -1;
      if (firstIdx < 0) break;
      const item = remaining.splice(firstIdx, 1)[0];
      picked.push(item);
      usedL2.add(item.categoryL2);
      continue;
    }

    let bestIdx = -1;
    let bestMmr = -Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const cand = remaining[i];
      if (!canTake(cand)) continue;
      const maxSim = picked.reduce(
        (mx, sel) => Math.max(mx, abstractSimilarity(sel.paper.abstract, cand.paper.abstract)),
        0
      );
      const l2Fresh = usedL2.has(cand.categoryL2) ? 0 : 0.1;
      const mmr = lambda * cand.score - (1 - lambda) * maxSim + l2Fresh;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) {
      let fallback = remaining.find((c) => canTake(c));
      if (!fallback) fallback = remaining[0];
      if (!fallback) break;
      const idx = remaining.indexOf(fallback);
      picked.push(remaining.splice(idx, 1)[0]);
      usedL2.add(fallback.categoryL2);
      continue;
    }

    const item = remaining.splice(bestIdx, 1)[0];
    picked.push(item);
    usedL2.add(item.categoryL2);
  }

  return picked;
}

/**
 * 農経2 + 隣接2 + セレンディピティ1 のクォータ選出（設計書 Phase 3-2）。
 * 不足分は adjacent プールから補充し、警告を返す。
 */
export async function selectWithQuotaMMR(
  papers: ArxivPaper[],
  options: SelectionOptions = {}
): Promise<QuotaSelectionResult> {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const now = options.now ?? new Date();
  const today = options.todayDate ?? now.toISOString().slice(0, 10);
  const maxPool = options.maxPapers ?? Math.max(50, papers.length);

  const categoryLoad = await loadRecentCategoryLoad(7, today);
  const categoryL2Load = await loadRecentCategoryL2Load(7, today);

  const scored = papers.map((p) =>
    scoreCandidate(p, {
      now,
      categoryLoad,
      categoryL2Load,
      interestVector: options.interestVector ?? {},
      weights,
      useInterestBoost: options.useInterestBoost ?? false,
    })
  );

  const buckets: Record<CategoryL1, ScoredCandidate[]> = {
    "agri-econ": [],
    adjacent: [],
    serendipity: [],
  };
  for (const s of scored) {
    buckets[s.categoryL1].push(s);
  }

  const warnings: string[] = [];
  const usedL2 = new Set<string>();
  const quotaPicks: ScoredCandidate[] = [];

  for (const l1 of L1_ORDER) {
    const need = DAILY_QUOTA[l1];
    const picked = mmrPickSlot(buckets[l1], need, usedL2);
    if (picked.length < need) {
      warnings.push(
        `${l1} が ${picked.length}/${need} 本しかありません（候補 ${buckets[l1].length} 件）`
      );
    }
    quotaPicks.push(...picked);
    const pickedIds = new Set(picked.map((p) => p.paper.id));
    buckets[l1] = buckets[l1].filter((c) => !pickedIds.has(c.paper.id));
  }

  while (quotaPicks.length < 5) {
    const fillPool = [...buckets.adjacent, ...buckets["agri-econ"], ...buckets.serendipity]
      .filter((c) => !quotaPicks.some((q) => q.paper.id === c.paper.id))
      .sort((a, b) => b.score - a.score);
    const extra = mmrPickSlot(fillPool, 1, usedL2);
    if (extra.length === 0) break;
    warnings.push(`クォータ不足のため ${extra[0].categoryL1} を補充: ${extra[0].paper.id}`);
    quotaPicks.push(...extra);
  }

  const primaryIds = new Set(quotaPicks.map((q) => q.paper.id));
  const backupPerSlot = 3;
  const backup: ScoredCandidate[] = [];
  for (const l1 of L1_ORDER) {
    const extra = mmrPickSlot(buckets[l1], backupPerSlot, usedL2);
    for (const e of extra) {
      if (!primaryIds.has(e.paper.id) && !backup.some((b) => b.paper.id === e.paper.id)) {
        backup.push(e);
      }
    }
  }

  const tail = scored
    .filter((s) => !primaryIds.has(s.paper.id) && !backup.some((b) => b.paper.id === s.paper.id))
    .sort((a, b) => b.score - a.score);

  const ordered = [...quotaPicks, ...backup, ...tail]
    .map((s) => s.paper)
    .slice(0, maxPool);

  return { ordered, quotaPicks: quotaPicks.slice(0, 5), warnings };
}

/** @deprecated 後方互換: クォータなし MMR（プール並べ替えのみ） */
export async function orderCandidatesWithMMR(
  papers: ArxivPaper[],
  options: SelectionOptions & { maxPerCategory?: number; minCategoryKinds?: number } = {}
): Promise<ArxivPaper[]> {
  const result = await selectWithQuotaMMR(papers, {
    maxPapers: options.maxPapers,
    weights: options.weights,
    interestVector: options.interestVector,
    useInterestBoost: options.useInterestBoost,
    todayDate: options.todayDate,
    now: options.now,
  });
  if (result.warnings.length > 0) {
    for (const w of result.warnings) console.warn(`  [選出] ${w}`);
  }
  return result.ordered;
}

export function histogramCategoryL1(papers: ArxivPaper[]): Record<CategoryL1, number> {
  const h: Record<CategoryL1, number> = {
    "agri-econ": 0,
    adjacent: 0,
    serendipity: 0,
  };
  for (const p of papers) {
    h[
      classifyPaper({
        categories: p.categories,
        abstract: p.abstract,
        title: p.title,
        field: p.field,
      }).categoryL1
    ] += 1;
  }
  return h;
}

export function histogramCategoryL2(papers: ArxivPaper[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const p of papers) {
    const l2 = classifyPaper({
      categories: p.categories,
      abstract: p.abstract,
      title: p.title,
      field: p.field,
    }).categoryL2;
    h[l2] = (h[l2] ?? 0) + 1;
  }
  return h;
}

/** クォータ制約違反を検出 */
export function validateDailyQuota(papers: ArxivPaper[]): string[] {
  const h = histogramCategoryL1(papers);
  const errors: string[] = [];
  for (const [l1, need] of Object.entries(DAILY_QUOTA) as [CategoryL1, number][]) {
    const got = h[l1] ?? 0;
    if (got !== need) {
      errors.push(`${l1}: 期待 ${need} 本 / 実際 ${got} 本`);
    }
  }
  return errors;
}
