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
