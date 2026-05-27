import type { Paper } from "@/lib/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_FETCH_TIMEOUT_MS = Number(process.env.GEMINI_FETCH_TIMEOUT_MS ?? 90_000);

export type FigureCandidate = {
  id: string;
  page: number;
  caption: string;
  label?: string;
  imageFile: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

function parseSelection(raw: string): { selectedId: string; caption: string; label?: string } | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      selectedId?: string;
      caption?: string;
      label?: string;
    };
    const selectedId = parsed.selectedId?.trim();
    const caption = parsed.caption?.trim();
    if (!selectedId || !caption) return null;
    return {
      selectedId,
      caption,
      label: parsed.label?.trim(),
    };
  } catch {
    return null;
  }
}

/** キャプション一覧と要約から、最重要図表を1件選定（テキストのみ） */
export async function selectBestFigureFromCaptions(
  candidates: FigureCandidate[],
  paper: Paper,
  apiKey: string
): Promise<FigureCandidate | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const resultsText = paper.summary?.results?.trim() || paper.summary?.gist || "";
  const list = candidates
    .map(
      (c, i) =>
        `[${i}] id=${c.id} page=${c.page} label=${c.label ?? "—"}\nキャプション: ${c.caption.slice(0, 400)}`
    )
    .join("\n\n");

  const prompt = [
    "あなたは学術論文の図表を評価する専門家です。",
    `論文タイトル: ${paper.titleJa ?? paper.title}`,
    "",
    "【論文の主要な結果（要約）】",
    resultsText.slice(0, 1200),
    "",
    "【抽出された図表候補】",
    list,
    "",
    "【タスク】",
    "研究の主要な結論を最もよく表している図または表を1つだけ選んでください。",
    "次を避ける: 表紙、研究フロー図のみ、地理図のみ（結果が主でない場合）、参考文献。",
    "次を優先: 回帰結果、処置効果、比較グラフ、主要な表。",
    "",
    'JSONのみ返す: {"selectedId":"候補のid","label":"Figure 3 など","caption":"80字以内の説明（です・ます調）"}',
  ].join("\n");

  const endpoint = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.15,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!response.ok) return candidates[0];

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const selection = parseSelection(text);
    if (!selection) return candidates[0];

    return (
      candidates.find((c) => c.id === selection.selectedId) ??
      candidates[0]
    );
  } catch {
    return candidates[0];
  } finally {
    clearTimeout(timeoutId);
  }
}

export type SectionFigureSelection = {
  results?: FigureCandidate;
  why?: FigureCandidate;
};

function parseSectionSelection(
  raw: string
): { resultsId?: string; whyId?: string; resultsCaption?: string; whyCaption?: string } | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      resultsId?: string;
      whyId?: string;
      resultsCaption?: string;
      whyCaption?: string;
    };
    return {
      resultsId: parsed.resultsId?.trim() || undefined,
      whyId: parsed.whyId?.trim() || undefined,
      resultsCaption: parsed.resultsCaption?.trim() || undefined,
      whyCaption: parsed.whyCaption?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 「わかったこと（results）」と「なぜそうなるのか（why）」それぞれに最適な図表を1枚ずつ選ぶ。
 * Gemini を 1 回呼ぶだけで両方決める。同じ図が両方に選ばれてもよいが、できれば別の図にする方針。
 */
export async function selectFiguresForSections(
  candidates: FigureCandidate[],
  paper: Paper,
  apiKey: string
): Promise<SectionFigureSelection> {
  if (candidates.length === 0) return {};

  const resultsText = paper.summary?.results?.trim() || "";
  const whyText = paper.summary?.why?.trim() || "";

  if (!resultsText && !whyText) {
    return { results: candidates[0] };
  }

  if (candidates.length === 1) {
    return { results: candidates[0] };
  }

  const list = candidates
    .map(
      (c) =>
        `id=${c.id} page=${c.page} label=${c.label ?? "—"}\nキャプション: ${c.caption.slice(0, 400)}`
    )
    .join("\n\n");

  const prompt = [
    "あなたは学術論文の図表を一般読者向けに紹介する編集者です。",
    `論文タイトル: ${paper.titleJa ?? paper.title}`,
    "",
    "【わかったこと（研究の主要な結果）】",
    resultsText.slice(0, 1000) || "(該当する記述なし)",
    "",
    "【なぜそうなるのか（メカニズム・因果の説明）】",
    whyText.slice(0, 1000) || "(該当する記述なし)",
    "",
    "【抽出された図表候補】",
    list,
    "",
    "【タスク】",
    "次の2種類の図を候補から1枚ずつ選んでください。",
    "1) resultsId: 『わかったこと』を最もよく裏付けるグラフ・表（処置効果・回帰結果・比較・主要な数値の図）",
    "2) whyId: 『なぜそうなるのか』を補強するメカニズム・経路・媒介変数・モデル概念図・分布など",
    "",
    "ルール:",
    "- 表紙、目次、参考文献、純粋な研究フロー図のみのものは選ばない。",
    "- 該当する『わかったこと』『なぜそうなるのか』の記述が空・薄い場合は、その項目は空文字 \"\" にする。",
    "- 同じ図を両方に選んでも構わないが、別々の図がある場合はできるだけ別を選ぶ。",
    "- caption は 80 字以内、です・ます調で、その図が何を示しているか日本語で説明。",
    "",
    'JSONのみ返す: {"resultsId":"...","resultsCaption":"...","whyId":"...","whyCaption":"..."}',
  ].join("\n");

  const endpoint = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.15,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!response.ok) return { results: candidates[0] };

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const sel = parseSectionSelection(text);
    if (!sel) return { results: candidates[0] };

    const out: SectionFigureSelection = {};
    if (sel.resultsId) {
      const found = candidates.find((c) => c.id === sel.resultsId);
      if (found) {
        out.results = sel.resultsCaption ? { ...found, caption: sel.resultsCaption } : found;
      }
    }
    if (sel.whyId) {
      const found = candidates.find((c) => c.id === sel.whyId);
      if (found) {
        out.why = sel.whyCaption ? { ...found, caption: sel.whyCaption } : found;
      }
    }

    if (!out.results && !out.why) {
      return { results: candidates[0] };
    }
    return out;
  } catch {
    return { results: candidates[0] };
  } finally {
    clearTimeout(timeoutId);
  }
}
