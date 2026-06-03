import type { ArxivPaper } from "@/lib/arxiv";
import { evaluateAnalogyQuality } from "@/lib/analogyQuality";
import { classifyPaper } from "@/lib/classifyPaper";
import { spansFromGlossaryTerms } from "@/lib/glossarySpans";
import {
  buildBodyText,
  stripInlineMarkup,
  validateBodyGlossary,
} from "@/lib/paperV2Validate";
import type {
  AnalogyBlock,
  AnalogyDomain,
  BodyGlossaryEntry,
  CategoryL1,
  GlossarySpan,
  GlossaryTerm,
  KpiItem,
  NoveltyContrast,
  PaperSummary,
  PredictionQuiz,
  StoryCards,
  Takeaway,
} from "@/lib/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_FETCH_TIMEOUT_MS = Number(process.env.GEMINI_FETCH_TIMEOUT_MS ?? 90_000);

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

export type GeminiV2SummaryResult = {
  summary: PaperSummary;
  titleJa?: string;
  catchTitle?: string;
  hook?: string;
  hookLead?: string;
  background?: string;
  threeLineSummary?: string[];
  oneLiner?: string;
  noveltyContrast?: NoveltyContrast;
  analogy?: AnalogyBlock;
  kpi?: KpiItem[];
  whyYouCare?: string;
  takeawayTalk?: string;
  glossary?: GlossaryTerm[];
  bodyText?: string;
  bodyGlossary?: BodyGlossaryEntry[];
  glossarySpans?: GlossarySpan[];
  categoryL1?: CategoryL1;
  categoryL2?: string;
  arxivPrimary?: string;
  agriEconRelevance?: string;
  analogyNeedsReview?: boolean;
  quiz?: PredictionQuiz;
  limitations?: string;
  takeaway?: Takeaway;
  storyCards?: StoryCards;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * 記事 v2 用 Gemini プロンプト（summarize パイプライン接続）
 */
export function buildPromptV2(
  paper: ArxivPaper,
  pdfExcerpt?: string | null,
  slotHint?: CategoryL1
): string {
  const abstractRaw = paper.abstract.trim() || "";
  const abstractForModel = abstractRaw
    ? decodeBasicEntities(abstractRaw)
    : "（公開アブストラクトなし。タイトルと著者情報から内容を推定して要約すること。）";
  const hasPdf = Boolean(pdfExcerpt?.trim());
  const slot =
    slotHint ??
    classifyPaper({
      categories: paper.categories,
      abstract: paper.abstract,
      title: paper.title,
      field: paper.field,
    }).categoryL1;

  return [
    "あなたは「論文ではなく発見を読む場所」という農業経済キュレーションサイトの編集者です。",
    "専門外の社会人が3分で「この研究面白い」と思える解説を、必ず以下JSONスキーマで出力してください。",
    "",
    "【最重要ルール】",
    "- analogy は必須。**農業文脈の比喩を最優先**（畑・収穫・天候・市場・流通・農機・品種改良など）",
    "  農経の比喩が困難な場合のみ cooking / market / weather / daily に切り替え（analogy.domain に記録）",
    "- hook は「あなた」を主語にするか、身近な異変・疑問形で始める（80字以内）",
    "- novelty.before / after は必ず対比（各120字以内）",
    "- why_you_care は専門外の読者の生活・仕事・社会と接続（150字程度）",
    `- category_l1 は "${slot}" を基本とする（agri-econ | adjacent | serendipity）`,
    '- category_l1 が "serendipity" のとき agri_econ_relevance は必須（農経への応用120字）',
    "- body_text は method と mechanism を結合した**プレーンテキスト**（マークアップ禁止）",
    "- glossary は body_text 内の専門用語最大8語、definition 各40字以内",
    "- glossary の start/end は body_text 内の該当語・最初の1回・UTF-16 index",
    "- method / results / mechanism は body_text と整合するプレーンテキスト",
    "- 数値が根拠に無い場合は推測しない",
    "",
    hasPdf
      ? "根拠: アブストラクトと【論文本文抜粋】。抜粋の因果を優先。"
      : "根拠: アブストラクトのみ。推測で因果を足さない。",
    "",
    "【JSONスキーマ】",
    "{",
    '  "titleJa": "論文タイトル日本語（80字以内）",',
    '  "catchTitle": "読者向け見出し（20〜32字）",',
    '  "hook": "フック（80字以内）",',
    '  "one_liner": "ひとことで言うと（1文・80字以内）",',
    '  "novelty": { "before": "従来", "after": "この論文" },',
    '  "analogy": { "title": "比喩タイトル", "body": "200字以内", "domain": "farming|cooking|market|weather|daily|other" },',
    '  "kpi": [{ "value": "+3.2pt", "label": "意味" }],',
    '  "category_l1": "agri-econ|adjacent|serendipity",',
    '  "category_l2": "farm-management 等",',
    '  "background": "背景",',
    '  "method": "手法",',
    '  "results": "結果",',
    '  "mechanism": "なぜそうなるか",',
    '  "body_text": "method + 改行2つ + mechanism のプレーンテキスト",',
    '  "glossary": [{ "term": "語", "definition": "解説", "start": 0, "end": 2 }],',
    '  "why_you_care": "読者への関連",',
    '  "agri_econ_relevance": "セレンディピティ時必須・他は空文字可",',
    '  "takeaway_talk": "友人に話せる1文（60字以内）",',
    '  "limitations": "",',
    '  "quiz": { "question": "", "options": ["","",""], "correctIndex": 0, "explanation": "" }',
    "}",
    "",
    "【対象論文】",
    `タイトル: ${paper.title}`,
    `著者: ${paper.authors.join(", ") || "不明"}`,
    `アブストラクト:\n${abstractForModel}`,
    ...(hasPdf
      ? ["", "【論文本文抜粋】", pdfExcerpt!.trim()]
      : []),
  ].join("\n");
}

function extractTextFromGeminiResponse(json: GeminiResponse): string {
  return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

function extractJsonObjectText(raw: string): string {
  let cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  return cleaned;
}

function parseJsonLoose(text: string): unknown | null {
  const cleaned = extractJsonObjectText(text);
  const attempts = [
    cleaned,
    cleaned.replace(/,\s*([}\]])/g, "$1"),
    cleaned.replace(/[\u0000-\u001F]+/g, " "),
  ];
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* continue */
    }
  }
  return null;
}

function parseQuiz(raw: unknown): PredictionQuiz | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const q = raw as Partial<PredictionQuiz>;
  if (typeof q.question !== "string" || !Array.isArray(q.options)) return undefined;
  const options = q.options.filter((o): o is string => typeof o === "string").slice(0, 3);
  const correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : 0;
  const explanation = typeof q.explanation === "string" ? q.explanation.trim() : "";
  if (options.length < 2 || !q.question.trim() || !explanation) return undefined;
  return {
    question: q.question.trim(),
    options,
    correctIndex: Math.min(options.length - 1, Math.max(0, correctIndex)),
    explanation,
  };
}

function parseGlossary(raw: unknown): GlossaryTerm[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const items: GlossaryTerm[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<GlossaryTerm>;
    const term = typeof e.term === "string" ? e.term.trim() : "";
    const definition = typeof e.definition === "string" ? e.definition.trim() : "";
    if (!term || !definition) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ term, definition });
    if (items.length >= 12) break;
  }
  return items.length > 0 ? items : undefined;
}

function parseGlossarySpans(raw: unknown): GlossarySpan[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const spans: GlossarySpan[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<GlossarySpan>;
    const term = typeof e.term === "string" ? e.term.trim() : "";
    const definition = typeof e.definition === "string" ? e.definition.trim() : "";
    const start = typeof e.start === "number" ? e.start : -1;
    const end = typeof e.end === "number" ? e.end : -1;
    if (!term || !definition || start < 0 || end <= start) continue;
    spans.push({ term, start, end, definition });
    if (spans.length >= 12) break;
  }
  return spans.length > 0 ? spans : undefined;
}

function parseNovelty(raw: unknown): NoveltyContrast | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const n = raw as Partial<NoveltyContrast>;
  const before = typeof n.before === "string" ? n.before.trim() : "";
  const after = typeof n.after === "string" ? n.after.trim() : "";
  if (!before || !after) return undefined;
  return { before, after };
}

function parseAnalogyDomain(raw: unknown): AnalogyDomain | undefined {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (
    v === "farming" ||
    v === "cooking" ||
    v === "market" ||
    v === "weather" ||
    v === "daily" ||
    v === "other"
  ) {
    return v;
  }
  return undefined;
}

function parseAnalogy(raw: unknown): AnalogyBlock | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Partial<AnalogyBlock & { domain?: string }>;
  const title = typeof a.title === "string" ? a.title.trim() : "";
  const body = typeof a.body === "string" ? a.body.trim() : "";
  if (!title || !body) return undefined;
  const domain = parseAnalogyDomain(a.domain);
  return { title, body, ...(domain ? { domain } : {}) };
}

function parseBodyGlossary(raw: unknown): BodyGlossaryEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: BodyGlossaryEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<BodyGlossaryEntry>;
    const term = typeof e.term === "string" ? e.term.trim() : "";
    const definition = typeof e.definition === "string" ? e.definition.trim() : "";
    const start = typeof e.start === "number" ? e.start : -1;
    const end = typeof e.end === "number" ? e.end : -1;
    if (!term || !definition || start < 0 || end <= start) continue;
    items.push({ term, definition, start, end });
    if (items.length >= 8) break;
  }
  return items.length > 0 ? items : undefined;
}

function parseCategoryL1(raw: unknown): CategoryL1 | undefined {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "agri-econ" || v === "adjacent" || v === "serendipity") return v;
  return undefined;
}

function parseKpi(raw: unknown): KpiItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: KpiItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const k = entry as Partial<KpiItem>;
    const value = typeof k.value === "string" ? k.value.trim() : "";
    const label = typeof k.label === "string" ? k.label.trim() : "";
    if (!value || !label) continue;
    items.push({ value, label });
    if (items.length >= 5) break;
  }
  return items.length > 0 ? items : undefined;
}

function parseTakeaway(raw: unknown): Takeaway | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Partial<Takeaway>;
  const what = typeof t.whatIsIt === "string" ? t.whatIsIt.trim() : "";
  const found = typeof t.whatFound === "string" ? t.whatFound.trim() : "";
  const so = typeof t.soWhat === "string" ? t.soWhat.trim() : "";
  if (!what || !found || !so) return undefined;
  return { whatIsIt: what, whatFound: found, soWhat: so };
}

function parseStoryCards(raw: unknown): StoryCards | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Partial<StoryCards>;
  const ask = typeof s.ask === "string" ? s.ask.trim() : "";
  const method = typeof s.method === "string" ? s.method.trim() : "";
  const finding = typeof s.finding === "string" ? s.finding.trim() : "";
  const meaning = typeof s.meaning === "string" ? s.meaning.trim() : "";
  if (!ask || !method || !finding || !meaning) return undefined;
  return { ask, method, finding, meaning };
}

function isValidSpan(text: string, span: GlossarySpan): boolean {
  if (span.start < 0 || span.end <= span.start || span.end > text.length) return false;
  return text.slice(span.start, span.end) === span.term;
}

/** LLM の span を検証し、不足分は glossary から補完 */
export function normalizeGlossarySpans(
  method: string,
  mechanism: string,
  spans: GlossarySpan[] | undefined,
  glossary: GlossaryTerm[] | undefined
): GlossarySpan[] {
  const valid = (spans ?? []).filter(
    (s) => isValidSpan(method, s) || isValidSpan(mechanism, s)
  );
  if (valid.length >= 2) return valid;

  const fromMethod = glossary ? spansFromGlossaryTerms(method, glossary) : [];
  const fromMech = glossary ? spansFromGlossaryTerms(mechanism, glossary) : [];
  const merged = [...valid];
  for (const s of [...fromMethod, ...fromMech]) {
    if (merged.some((m) => m.term === s.term)) continue;
    merged.push(s);
  }
  return merged.sort((a, b) => a.start - b.start);
}

export function parseGeminiV2Response(raw: string): GeminiV2SummaryResult | null {
  const parsed = parseJsonLoose(raw) as Record<string, unknown> | null;
  if (!parsed) return null;

  const method = stripInlineMarkup(
    typeof parsed.method === "string" ? parsed.method.trim() : ""
  );
  const results = stripInlineMarkup(
    typeof parsed.results === "string" ? parsed.results.trim() : ""
  );
  const background = stripInlineMarkup(
    typeof parsed.background === "string" ? parsed.background.trim() : ""
  );
  if (!method || !results) return null;

  const mechanism = stripInlineMarkup(
    typeof parsed.mechanism === "string" ? parsed.mechanism.trim() : ""
  );
  const noveltyContrast = parseNovelty(parsed.novelty);
  const gist = background || (typeof parsed.one_liner === "string" ? parsed.one_liner.trim() : "");
  const noveltyStr = noveltyContrast
    ? `${noveltyContrast.before} ${noveltyContrast.after}`
    : "";

  const bodyTextRaw =
    typeof parsed.body_text === "string" ? stripInlineMarkup(parsed.body_text.trim()) : "";
  const bodyText = bodyTextRaw || buildBodyText(method, mechanism);
  const glossaryParsed = parseBodyGlossary(parsed.glossary) ?? parseGlossarySpans(parsed.glossary);
  const glossaryLegacy = parseGlossary(parsed.glossary);
  const glossaryValidated = validateBodyGlossary(bodyText, glossaryParsed);
  let bodyGlossary = glossaryValidated.valid;
  const bodyGlossaryInvalid = glossaryValidated.invalid;
  if (bodyGlossaryInvalid > 0 && glossaryLegacy?.length) {
    bodyGlossary = spansFromGlossaryTerms(bodyText, glossaryLegacy).map((s) => ({
      term: s.term,
      definition: s.definition,
      start: s.start,
      end: s.end,
      reading: s.reading,
    }));
  } else if (bodyGlossaryInvalid > 0 && bodyGlossary.length) {
    const terms = bodyGlossary.map((g) => ({
      term: g.term,
      definition: g.definition,
      reading: g.reading,
    }));
    bodyGlossary = spansFromGlossaryTerms(bodyText, terms).map((s) => ({
      term: s.term,
      definition: s.definition,
      start: s.start,
      end: s.end,
      reading: s.reading,
    }));
  }
  const glossarySpans =
    bodyGlossary.length > 0
      ? bodyGlossary
      : normalizeGlossarySpans(method, mechanism, undefined, glossaryLegacy);
  const glossary = glossaryLegacy ?? bodyGlossary.map((g) => ({ term: g.term, definition: g.definition }));

  const categoryL1 = parseCategoryL1(parsed.category_l1);
  const agriEconRelevance =
    typeof parsed.agri_econ_relevance === "string"
      ? parsed.agri_econ_relevance.trim()
      : undefined;

  const figures =
    typeof parsed.figures === "string" && parsed.figures.trim()
      ? parsed.figures.trim()
      : undefined;

  const threeLine = Array.isArray(parsed.three_line_summary)
    ? (parsed.three_line_summary as unknown[])
        .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
        .map((l) => l.trim())
        .slice(0, 3)
    : undefined;

  return {
    summary: {
      gist: gist || method.slice(0, 200),
      novelty: noveltyStr || results.slice(0, 200),
      method,
      results,
      why: mechanism,
      figures,
    },
    titleJa:
      typeof parsed.titleJa === "string" && parsed.titleJa.trim()
        ? parsed.titleJa.trim()
        : undefined,
    catchTitle:
      typeof parsed.catchTitle === "string" && parsed.catchTitle.trim()
        ? parsed.catchTitle.trim()
        : undefined,
    hook:
      typeof parsed.hook === "string" && parsed.hook.trim() ? parsed.hook.trim() : undefined,
    hookLead:
      typeof parsed.hook_lead === "string" && parsed.hook_lead.trim()
        ? parsed.hook_lead.trim()
        : undefined,
    background: background || undefined,
    threeLineSummary: threeLine?.length ? threeLine : undefined,
    oneLiner:
      typeof parsed.one_liner === "string" && parsed.one_liner.trim()
        ? parsed.one_liner.trim()
        : undefined,
    noveltyContrast,
    analogy: parseAnalogy(parsed.analogy),
    kpi: parseKpi(parsed.kpi),
    whyYouCare:
      typeof parsed.why_you_care === "string" && parsed.why_you_care.trim()
        ? parsed.why_you_care.trim()
        : undefined,
    takeawayTalk:
      typeof parsed.takeaway_talk === "string" && parsed.takeaway_talk.trim()
        ? parsed.takeaway_talk.trim()
        : undefined,
    glossary,
    bodyText,
    bodyGlossary: bodyGlossary.length > 0 ? bodyGlossary : undefined,
    glossarySpans: glossarySpans.length > 0 ? glossarySpans : undefined,
    categoryL1,
    categoryL2:
      typeof parsed.category_l2 === "string" && parsed.category_l2.trim()
        ? parsed.category_l2.trim()
        : undefined,
    agriEconRelevance,
    quiz: parseQuiz(parsed.quiz),
    limitations:
      typeof parsed.limitations === "string" ? parsed.limitations.trim() : undefined,
    takeaway: parseTakeaway(parsed.takeaway),
    storyCards: parseStoryCards(parsed.storyCards),
  };
}

function fallbackSummary(abstract: string): PaperSummary {
  const body = abstract.trim() || "（アブストラクトなし）";
  return {
    gist: "要約生成に失敗しました（原文をご参照ください）",
    novelty: body,
    method: body,
    results: body,
  };
}

export function isSummarizeArticleV2Enabled(): boolean {
  const v = process.env.SUMMARIZE_ARTICLE_V2 ?? "";
  return v === "1" || v === "true";
}

/** v2 専用フィールドが未生成か */
export function needsArticleV2Fields(paper: {
  oneLiner?: string;
  analogy?: AnalogyBlock;
  noveltyContrast?: NoveltyContrast;
  bodyText?: string;
  bodyGlossary?: BodyGlossaryEntry[];
}): boolean {
  if (!paper.oneLiner?.trim()) return true;
  if (!paper.analogy?.body?.trim()) return true;
  if (!paper.noveltyContrast?.before?.trim() || !paper.noveltyContrast?.after?.trim()) {
    return true;
  }
  if (!paper.bodyText?.trim() && !paper.bodyGlossary?.length) return true;
  return false;
}

async function callGeminiJson(prompt: string, apiKey: string, temperature = 0.35): Promise<string> {
  const endpoint = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errBody.slice(0, 200)}`);
  }
  const data = (await response.json()) as GeminiResponse;
  return extractTextFromGeminiResponse(data);
}

export async function summarizeWithGeminiV2(
  paper: ArxivPaper,
  apiKey: string,
  retryCount = 3,
  pdfExcerpt?: string | null
): Promise<GeminiV2SummaryResult> {
  const slot = classifyPaper({
    categories: paper.categories,
    abstract: paper.abstract,
    title: paper.title,
    field: paper.field,
  }).categoryL1;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_FETCH_TIMEOUT_MS);

    try {
      const responseText = await callGeminiJson(buildPromptV2(paper, pdfExcerpt, slot), apiKey);
      let parsed = parseGeminiV2Response(responseText);
      if (!parsed) throw new Error("Gemini v2 response is not valid JSON.");

      let analogyAttempts = 0;
      while (parsed.analogy?.body && analogyAttempts < 2) {
        const verdict = await evaluateAnalogyQuality(
          parsed.analogy.title,
          parsed.analogy.body,
          apiKey
        );
        if (verdict.ok) break;
        analogyAttempts += 1;
        const regen = await callGeminiJson(
          [
            buildPromptV2(paper, pdfExcerpt, slot),
            "",
            "前回の analogy が品質基準を満たしませんでした。農業文脈の比喩で analogy のみ改善して同じJSON全体を再出力してください。",
            `NG理由: ${verdict.reason ?? "quality"}`,
          ].join("\n"),
          apiKey,
          0.4
        );
        const reparsed = parseGeminiV2Response(regen);
        if (reparsed) parsed = reparsed;
      }

      if (parsed.analogy?.body) {
        const finalVerdict = await evaluateAnalogyQuality(
          parsed.analogy.title,
          parsed.analogy.body,
          apiKey
        );
        if (!finalVerdict.ok) {
          parsed = {
            ...parsed,
            analogy: { title: parsed.analogy.title, body: "" },
            analogyNeedsReview: true,
          };
        }
      }

      if (slot === "serendipity" && !parsed.agriEconRelevance?.trim()) {
        parsed.agriEconRelevance =
          "農業経済のデータ不足・因果推論・政策評価・気候適応などへの手法応用の可能性は、本要約の範囲で要確認です。";
      }

      return parsed;
    } catch (error) {
      if (attempt === retryCount) {
        console.error(`Gemini v2 summary failed for ${paper.id}:`, error);
        return { summary: fallbackSummary(paper.abstract) };
      }
      await sleep(1000);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { summary: fallbackSummary(paper.abstract) };
}
