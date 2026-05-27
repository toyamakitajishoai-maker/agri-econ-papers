import type { PaperSummary } from "@/lib/types";

/** 旧形式（既存 JSON との互換） */
type LegacyPaperSummary = {
  oneLine?: string;
  background?: string;
  method?: string;
  findings?: string[];
  implications?: string;
};

export function isAcademicSummary(
  summary: PaperSummary | LegacyPaperSummary
): summary is PaperSummary {
  const s = summary as PaperSummary;
  return (
    typeof s.gist === "string" &&
    s.gist.length > 0 &&
    typeof s.novelty === "string" &&
    typeof s.method === "string" &&
    typeof s.results === "string"
  );
}

/** 一覧カード用の見出し（要点） */
export function getSummaryHeadline(summary: PaperSummary | LegacyPaperSummary): string {
  if (isAcademicSummary(summary)) return summary.gist;
  return summary.oneLine ?? "要約なし";
}

/** 一覧カード用の抜粋（結果の先頭） */
export function getSummaryExcerpt(summary: PaperSummary | LegacyPaperSummary): string {
  if (isAcademicSummary(summary)) return summary.results;
  if (summary.findings?.length) return summary.findings[0];
  return summary.implications ?? summary.background ?? "";
}

export type SummarySection = {
  title: string;
  body: string;
};

/** 詳細ページ用の4項目（旧形式は従来ラベルで表示） */
export function getSummarySections(summary: PaperSummary | LegacyPaperSummary): SummarySection[] {
  if (isAcademicSummary(summary)) {
    return [
      { title: "要点", body: summary.gist },
      { title: "新規性", body: summary.novelty },
      { title: "手法", body: summary.method },
      { title: "結果", body: summary.results },
      ...(summary.why?.trim() ? [{ title: "なぜそうなるのか", body: summary.why }] : []),
      ...(summary.figures?.trim() ? [{ title: "図表", body: summary.figures }] : []),
    ];
  }

  return [
    { title: "一行サマリ", body: summary.oneLine ?? "" },
    { title: "研究の背景・課題", body: summary.background ?? "" },
    { title: "手法・データ", body: summary.method ?? "" },
    {
      title: "主な発見",
      body: (summary.findings ?? []).join("\n"),
    },
    { title: "農業経済への示唆", body: summary.implications ?? "" },
  ].filter((s) => s.body.trim().length > 0);
}
