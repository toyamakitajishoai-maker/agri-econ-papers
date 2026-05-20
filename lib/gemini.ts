import type { ArxivPaper } from "@/lib/arxiv";
import type { PaperSummary } from "@/lib/types";

/** 2.0 系は新規APIキーでは 404 になるため 2.5 を既定にする */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export type SummarizedPaper = ArxivPaper & {
  summary: PaperSummary;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
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

function buildPrompt(paper: ArxivPaper): string {
  const abstractRaw = paper.abstract.trim() || "";
  const abstractForModel = abstractRaw
    ? decodeBasicEntities(abstractRaw)
    : "（公開アブストラクトなし。タイトルと著者情報から内容を推定して要約すること。）";

  return [
    "あなたは農業経済学の専門家であり、優れた学術リサーチャーである。",
    "以下の【対象論文データ】を読み、指定された【出力フォーマット】と【制約条件】に厳密に従って要約を作成すること。",
    "",
    "【制約条件】",
    "・文末は必ず「だ・である」調（常体）で統一すること。「です・ます」調（敬体）は一切使用しないこと。",
    "・自身の論文の「先行研究レビュー」としてそのまま掲載できるよう、客観的かつ洗練された学術的な表現を用いること。",
    "・専門用語を正確に使用しつつも、論理展開が飛躍しないよう分かりやすい文章を心がけること。",
    "・冗長な表現を避け、重要な要素のみを抽出して情報量と簡潔さのバランスを保つこと。",
    "・英語のアブストラクトをそのままコピーしないこと。すべて日本語で記述すること。",
    "",
    "【出力フォーマット】",
    "以下の4項目を、それぞれ箇条書きではなく、文章として自然に読める形で記述すること。",
    "",
    "1. 要点",
    "（この論文が何を明らかにしたのか、全体の結論を1〜2文で端的に説明する）",
    "",
    "2. 新規性",
    "（従来の研究と比較して何が新しいのか、どのような研究の空白（リサーチギャップ）を埋めたのかを説明する）",
    "",
    "3. 手法",
    "（使用されたデータセットの特徴、対象期間、および具体的な計量経済学的なモデルや分析手法を説明する）",
    "",
    "4. 結果",
    "（分析から得られた具体的な結果、推定値の意味、およびそれが示唆する結論を説明する）",
    "",
    "【API出力指定】",
    "上記4項目に対応するキーだけを持つJSONオブジェクト1つを出力すること（前後に説明文やコードブロック記号を付けない）。",
    "各値は必ず文字列とし、配列にしないこと。",
    "",
    "{",
    '  "titleJa": "論文タイトルの日本語訳（学術的な見出し、80字以内）",',
    '  "gist": "要点の文章（だ・である調）",',
    '  "novelty": "新規性の文章（だ・である調）",',
    '  "method": "手法の文章（だ・である調）",',
    '  "results": "結果の文章（だ・である調）"',
    "}",
    "",
    "【対象論文データ】",
    `タイトル: ${paper.title}`,
    `著者: ${paper.authors.join(", ") || "不明"}`,
    `アブストラクト:\n${abstractForModel}`,
  ].join("\n");
}

function extractTextFromGeminiResponse(json: GeminiResponse): string {
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text.trim();
}

export type GeminiSummaryResult = {
  summary: PaperSummary;
  titleJa?: string;
};

function parseSummaryText(raw: string): GeminiSummaryResult | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<PaperSummary & { titleJa?: string }>;
    if (
      typeof parsed.gist === "string" &&
      typeof parsed.novelty === "string" &&
      typeof parsed.method === "string" &&
      typeof parsed.results === "string"
    ) {
      const titleJa =
        typeof parsed.titleJa === "string" && parsed.titleJa.trim() ? parsed.titleJa.trim() : undefined;
      return {
        summary: {
          gist: parsed.gist.trim(),
          novelty: parsed.novelty.trim(),
          method: parsed.method.trim(),
          results: parsed.results.trim(),
        },
        titleJa,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function fallbackSummary(abstract: string): PaperSummary {
  const body = abstract.trim() || "（アブストラクトなし）";
  return {
    gist: "要約生成に失敗した（原文参照）",
    novelty: body,
    method: body,
    results: body,
  };
}

export async function summarizeAbstractWithGemini(
  paper: ArxivPaper,
  apiKey: string,
  retryCount = 3
): Promise<GeminiSummaryResult> {
  const endpoint = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildPrompt(paper) }],
            },
          ],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        const msg = `Gemini API error: ${response.status} ${response.statusText} - ${errBody.slice(0, 300)}`;
        if ((response.status === 429 || response.status === 503) && attempt < retryCount) {
          await sleep(4000 * attempt);
          continue;
        }
        throw new Error(msg);
      }

      const data = (await response.json()) as GeminiResponse;
      const responseText = extractTextFromGeminiResponse(data);
      const parsed = parseSummaryText(responseText);

      if (!parsed) {
        throw new Error("Gemini response is not valid summary JSON.");
      }

      return parsed;
    } catch (error) {
      if (attempt === retryCount) {
        console.error(`Gemini summary failed for ${paper.id}:`, error);
        return { summary: fallbackSummary(paper.abstract) };
      }
      await sleep(1000);
    }
  }

  return { summary: fallbackSummary(paper.abstract) };
}

export async function summarizePapersWithGemini(
  papers: ArxivPaper[],
  apiKey: string
): Promise<SummarizedPaper[]> {
  const results: SummarizedPaper[] = [];

  for (const paper of papers) {
    const { summary } = await summarizeAbstractWithGemini(paper, apiKey, 3);
    results.push({ ...paper, summary });
    await sleep(1000);
  }

  return results;
}
