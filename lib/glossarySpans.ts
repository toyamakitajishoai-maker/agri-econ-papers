import type { GlossarySpan, GlossaryTerm } from "@/lib/types";

export type TextSegment =
  | { kind: "text"; value: string }
  | { kind: "term"; value: string; definition: string; reading?: string };

/** 重なりを除いてソート */
function dedupeSpans(spans: GlossarySpan[]): GlossarySpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: GlossarySpan[] = [];
  for (const s of sorted) {
    if (out.some((x) => !(s.end <= x.start || s.start >= x.end))) continue;
    out.push(s);
  }
  return out;
}

/** 本文と span が一致するか検証 */
function isValidSpan(text: string, span: GlossarySpan): boolean {
  if (span.start < 0 || span.end <= span.start || span.end > text.length) return false;
  const slice = text.slice(span.start, span.end);
  return slice === span.term;
}

/**
 * glossary_spans からセグメントを組み立て（置換ではなく挿入）。
 * 不正な span は無視し、本文文字列は必ず欠落しない。
 */
export function buildSegmentsFromSpans(text: string, spans: GlossarySpan[]): TextSegment[] {
  if (!text) return [];
  const valid = dedupeSpans(spans.filter((s) => isValidSpan(text, s)));
  if (valid.length === 0) return [{ kind: "text", value: text }];

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const s of valid) {
    if (s.start < cursor) continue;
    if (s.start > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, s.start) });
    }
    segments.push({
      kind: "term",
      value: text.slice(s.start, s.end),
      definition: s.definition,
      reading: s.reading,
    });
    cursor = s.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }
  return segments;
}

/** glossary から本文の最初の出現位置で span を生成（v2 フォールバック） */
export function spansFromGlossaryTerms(text: string, glossary: GlossaryTerm[]): GlossarySpan[] {
  const spans: GlossarySpan[] = [];
  const used: { start: number; end: number }[] = [];

  const sorted = [...glossary].sort((a, b) => b.term.length - a.term.length);
  for (const g of sorted) {
    const t = g.term.trim();
    if (!t) continue;
    const idx = text.indexOf(t);
    if (idx < 0) continue;
    const end = idx + t.length;
    if (used.some((u) => !(end <= u.start || idx >= u.end))) continue;
    used.push({ start: idx, end });
    spans.push({
      term: t,
      start: idx,
      end,
      definition: g.definition,
      reading: g.reading,
    });
  }
  return spans.sort((a, b) => a.start - b.start);
}
