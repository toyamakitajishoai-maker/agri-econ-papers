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
    figures?: string;
  };
};

const TAG_LABELS: Record<string, string> = {
  "Food security": "食料安全保障",
  "Business": "ビジネス",
  "Economics": "経済学",
  "Agriculture": "農業",
  "Rural": "農村",
  "Policy": "政策",
  "Sustainability": "持続可能性",
  "Climate change": "気候変動",
  "openalex": "",
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

export function getTags(paper: Paper, max = 4): string[] {
  const fromCats = paper.categories
    .filter((c) => c !== "openalex" && !c.startsWith("arxiv"))
    .map((c) => TAG_LABELS[c] ?? c)
    .filter(Boolean);

  const journal = getJournalLabel(paper);
  const tags = [...fromCats];
  if (journal.includes("arXiv")) tags.push("プレプリント");
  else if (journal !== "掲載誌情報なし") tags.push("査読論文");

  const unique = [...new Set(tags)];
  if (unique.length >= 2) return unique.slice(0, max);

  return ["農業", "食と農村", "今日の研究", "3分で読む"].slice(0, max);
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
