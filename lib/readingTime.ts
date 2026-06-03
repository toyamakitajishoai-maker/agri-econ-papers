import type { Paper } from "@/lib/types";

/** 日本語 500字/分 + 図1枚30秒 */
const CHARS_PER_MINUTE = 500;
const SECONDS_PER_FIGURE = 30;

function countChars(parts: (string | undefined)[]): number {
  return parts.reduce((sum, p) => sum + (p?.trim().length ?? 0), 0);
}

/** v2 記事の読了秒数を推定 */
export function estimateReadingTimeSecV2(paper: Paper): number {
  const s = paper.summary;
  const figureCount =
    (paper.articleFiguresV2?.length ?? 0) +
    (paper.keyFigures?.length ?? 0) +
    (paper.keyFigure ? 1 : 0);

  const chars = countChars([
    paper.catchTitle,
    paper.oneLiner,
    paper.hook,
    paper.hookLead,
    paper.background,
    paper.noveltyContrast?.before,
    paper.noveltyContrast?.after,
    paper.analogy?.title,
    paper.analogy?.body,
    ...(paper.kpi?.map((k) => `${k.value}${k.label}`) ?? []),
    s.gist,
    s.method,
    s.results,
    s.why,
    paper.whyYouCare,
    paper.takeawayTalk,
    paper.takeaway?.whatIsIt,
    paper.takeaway?.whatFound,
    paper.takeaway?.soWhat,
  ]);

  const fromText = Math.ceil((chars / CHARS_PER_MINUTE) * 60);
  const fromFigures = figureCount * SECONDS_PER_FIGURE;
  return Math.max(90, Math.min(600, fromText + fromFigures));
}

/** 表示用「約 N 分」 */
export function formatReadingMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}
