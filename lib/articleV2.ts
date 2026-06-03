import { isArticleV2FlagEnabled } from "@/lib/flags";
import { spansFromGlossaryTerms } from "@/lib/glossarySpans";
import { stripInlineMarkup, validateBodyGlossary } from "@/lib/paperV2Validate";
import type { GlossarySpan, Paper } from "@/lib/types";

/** v2 データが記事に含まれているか */
export function hasArticleV2Data(paper: Paper): boolean {
  return Boolean(
    paper.useArticleV2 ||
      paper.oneLiner?.trim() ||
      paper.analogy?.body?.trim() ||
      paper.bodyText?.trim()
  );
}

/** v2 テンプレートを表示するか（flag ON なら全記事 v2、OFF でも v2 データがあれば v2） */
export function shouldRenderArticleV2(paper: Paper): boolean {
  return isArticleV2FlagEnabled() || hasArticleV2Data(paper);
}

/** 本文と一致する用語位置だけを返す（ずれている span は用語集から再計算） */
export function resolveBodyGlossarySpans(
  paper: Paper,
  bodyText: string
): GlossarySpan[] | undefined {
  const text = stripInlineMarkup(bodyText);
  if (!text) return undefined;

  const raw = paper.bodyGlossary ?? paper.glossarySpans;
  const { valid, invalid } = validateBodyGlossary(text, raw);
  if (valid.length > 0 && invalid === 0) {
    return valid.map((g) => ({
      term: g.term,
      start: g.start,
      end: g.end,
      definition: g.definition,
      reading: g.reading,
    }));
  }

  const glossary = paper.glossary ?? [];
  const fromTerms =
    glossary.length > 0
      ? spansFromGlossaryTerms(
          text,
          glossary.map((g) => ({
            term: g.term,
            definition: g.definition,
            reading: g.reading,
          }))
        )
      : [];

  if (fromTerms.length > 0) return fromTerms;
  if (valid.length > 0) {
    return valid.map((g) => ({
      term: g.term,
      start: g.start,
      end: g.end,
      definition: g.definition,
      reading: g.reading,
    }));
  }
  return undefined;
}

/** 「記事要約（わかりやすく）」用のプレーン本文 */
export function getArticleBodyText(paper: Paper): string {
  const stored = paper.bodyText?.trim();
  if (stored) return stored;

  const method = paper.summary?.method?.trim() ?? "";
  const mechanism = paper.summary?.why?.trim() ?? "";
  if (method && mechanism) return `${method}\n\n${mechanism}`;
  return method || mechanism;
}
