import { normalizeCategory } from "@/lib/categoryMap";
import { getJournalLabel } from "@/lib/journal";
import { isAcademicSummary } from "@/lib/summary";
import type { Paper, PaperSummary } from "@/lib/types";

export type EditorialView = {
  catchTitle: string;
  hook: string;
  threeLineSummary: string[];
  insight: string;
  relevance: string;
  tags: string[];
  readMinutes: number;
  sections: {
    gist: string;
    novelty: string;
    method: string;
    results: string;
    why?: string;
    figures?: string;
  };
};

function firstSentence(text: string, maxLen = 120): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^。！？.!?]+[。！？.!?]?/);
  const sentence = (match?.[0] ?? trimmed).trim();
  if (sentence.length <= maxLen) return sentence;
  return `${sentence.slice(0, maxLen - 1)}…`;
}

function toSentences(text: string): string[] {
  const matches = text.match(/[^。！？.!?]+[。！？.!?]?/g);
  return (matches ?? [text]).map((s) => s.trim()).filter(Boolean);
}

/** 20〜32文字程度のキャッチタイトル */
export function getCatchTitle(paper: Paper): string {
  const stored = paper.catchTitle?.trim();
  if (stored) return stored;

  const ja = paper.titleJa?.trim();
  if (ja && ja.length >= 8 && ja.length <= 36) {
    return ja.replace(/[：:].+$/, "").trim();
  }
  if (ja && ja.length > 36) {
    const cut = ja.slice(0, 32);
    const lastPunct = Math.max(cut.lastIndexOf("、"), cut.lastIndexOf("，"));
    if (lastPunct > 14) return cut.slice(0, lastPunct);
    return `${cut}…`;
  }

  const summary = paper.summary;
  if (isAcademicSummary(summary)) {
    const hook = firstSentence(summary.gist, 40);
    if (hook.length >= 10) {
      return hook.replace(/^本研究は[、,]?/, "").replace(/(である|です)[。.]?$/, "").slice(0, 32);
    }
  }

  const en = paper.title.trim();
  if (en.length <= 32) return en;
  return `${en.slice(0, 30)}…`;
}

export function getHook(paper: Paper): string {
  const stored = paper.hook?.trim();
  if (stored) return stored;

  const s = paper.summary;
  if (isAcademicSummary(s)) {
    const hook = firstSentence(s.gist, 100);
    if (hook) return hook;
  }
  return firstSentence(paper.abstract, 100) || "今日の研究から、ひとつ発見を持ち帰る。";
}

export function getThreeLineSummary(paper: Paper): string[] {
  const override = paper.threeLineSummary?.filter((l) => l.trim());
  if (override && override.length > 0) return override.slice(0, 3);

  const s = paper.summary;
  if (isAcademicSummary(s)) {
    const parts = [...toSentences(s.gist), ...toSentences(s.results)].slice(0, 3);
    if (parts.length >= 2) return parts;
    if (parts.length === 1) {
      return [parts[0], firstSentence(s.novelty, 80), firstSentence(s.method, 80)].filter(Boolean);
    }
  }
  const legacy = s as PaperSummary & { oneLine?: string; findings?: string[] };
  const lines = [legacy.oneLine, ...(legacy.findings ?? [])].filter(Boolean).slice(0, 3) as string[];
  if (lines.length > 0) return lines;
  return [firstSentence(paper.abstract, 90)].filter(Boolean);
}

export function getInsight(paper: Paper): string {
  const s = paper.summary;
  if (isAcademicSummary(s)) {
    return firstSentence(s.novelty, 140) || firstSentence(s.gist, 140);
  }
  return firstSentence((s as { implications?: string }).implications ?? paper.abstract, 140);
}

export function getRelevance(paper: Paper): string {
  const s = paper.summary;
  if (isAcademicSummary(s)) {
    const fromResults = firstSentence(s.results, 160);
    if (fromResults.length > 20) return fromResults;
    return firstSentence(s.novelty, 160);
  }
  return firstSentence(paper.abstract, 160);
}

/**
 * タグ抽出ロジック（大分類 + 中分類のハイブリッド）
 * 優先順:
 *   1. field（収集時に割り当てた分野＝大分類）
 *   2. categories を normalizeCategory で日本語化（中分類、ノイズ除外）
 *   3. 媒体種別（プレプリント / 査読論文）
 * 重複は除去、上限 max 件まで。
 */
export function getTags(paper: Paper, max = 4): string[] {
  const tags: string[] = [];
  const field = paper.field?.trim();
  if (field) tags.push(field);

  const seen = new Set(tags);
  for (const raw of paper.categories ?? []) {
    const normalized = normalizeCategory(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
    /** 中分類は最大2個まで（field と合わせて3個まで） */
    if (tags.length >= 3) break;
  }

  const journal = getJournalLabel(paper);
  const journalTag = journal.includes("arXiv")
    ? "プレプリント"
    : journal !== "掲載誌情報なし"
      ? "査読論文"
      : null;
  if (journalTag && !seen.has(journalTag)) {
    tags.push(journalTag);
    seen.add(journalTag);
  }

  if (tags.length === 0) return ["今日の研究"];
  return tags.slice(0, max);
}

export function getReadMinutes(paper: Paper): number {
  const s = paper.summary;
  let chars = paper.abstract.length;
  if (isAcademicSummary(s)) {
    chars = s.gist.length + s.novelty.length + s.method.length + s.results.length;
  }
  const minutes = Math.ceil(chars / 450);
  return Math.min(5, Math.max(2, minutes));
}

function getSections(paper: Paper): EditorialView["sections"] {
  const s = paper.summary;
  if (isAcademicSummary(s)) {
    return {
      gist: s.gist,
      novelty: s.novelty,
      method: s.method,
      results: s.results,
      why: s.why,
      figures: s.figures,
    };
  }
  const legacy = s as PaperSummary & {
    oneLine?: string;
    background?: string;
    findings?: string[];
    implications?: string;
  };
  return {
    gist: legacy.oneLine ?? legacy.background ?? "",
    novelty: legacy.implications ?? "",
    method: legacy.method ?? "",
    results: (legacy.findings ?? []).join("\n") || legacy.implications || "",
  };
}

export function buildEditorialView(paper: Paper): EditorialView {
  return {
    catchTitle: getCatchTitle(paper),
    hook: getHook(paper),
    threeLineSummary: getThreeLineSummary(paper),
    insight: getInsight(paper),
    relevance: getRelevance(paper),
    tags: getTags(paper),
    readMinutes: getReadMinutes(paper),
    sections: getSections(paper),
  };
}
