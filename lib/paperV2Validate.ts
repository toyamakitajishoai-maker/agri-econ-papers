import type { BodyGlossaryEntry, GlossarySpan } from "@/lib/types";

export type GlossaryValidationResult = {
  valid: BodyGlossaryEntry[];
  invalid: number;
};

/** body_text 内の glossary 位置を実行時検証（zod 相当の軽量チェック） */
export function validateBodyGlossary(
  bodyText: string,
  entries: BodyGlossaryEntry[] | GlossarySpan[] | undefined
): GlossaryValidationResult {
  if (!bodyText?.trim() || !entries?.length) {
    return { valid: [], invalid: 0 };
  }

  const valid: BodyGlossaryEntry[] = [];
  let invalid = 0;

  for (const e of entries) {
    const term = e.term?.trim();
    const definition = e.definition?.trim();
    const start = e.start;
    const end = e.end;
    if (!term || !definition || typeof start !== "number" || typeof end !== "number") {
      invalid += 1;
      continue;
    }
    if (start < 0 || end <= start || end > bodyText.length) {
      invalid += 1;
      continue;
    }
    if (bodyText.slice(start, end) !== term) {
      invalid += 1;
      continue;
    }
    valid.push({ term, definition, start, end, reading: e.reading });
  }

  return { valid, invalid };
}

/** プレーンテキストからマークダウン強調を除去（LLM 混入対策） */
export function stripInlineMarkup(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function buildBodyText(method: string, mechanism: string): string {
  const m = stripInlineMarkup(method.trim());
  const mech = stripInlineMarkup(mechanism.trim());
  if (!mech) return m;
  if (!m) return mech;
  return `${m}\n\n${mech}`;
}

/** method / mechanism 用に body_text 内オフセットの span を分割 */
export function spansForSection(
  bodyText: string,
  sectionText: string,
  allSpans: BodyGlossaryEntry[]
): GlossarySpan[] {
  if (!sectionText.trim() || !allSpans.length) return [];
  const offset = bodyText.indexOf(sectionText);
  if (offset < 0) {
    return allSpans.filter((s) => sectionText.includes(s.term));
  }
  const end = offset + sectionText.length;
  return allSpans
    .filter((s) => s.start >= offset && s.end <= end)
    .map((s) => ({
      term: s.term,
      definition: s.definition,
      reading: s.reading,
      start: s.start - offset,
      end: s.end - offset,
    }));
}
