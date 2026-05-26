import type { ArxivPaper } from "@/lib/arxiv";
import type { PaperSummary } from "@/lib/types";

/** 2.0 系は新規APIキーでは 404 になるため 2.5 を既定にする */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
/** 2.5-flash の思考モードは1件60秒超になるため無効化 */
const GEMINI_FETCH_TIMEOUT_MS = Number(process.env.GEMINI_FETCH_TIMEOUT_MS ?? 90_000);

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
    "あなたは農業経済学の専門家であり、優れた学術リサーチャーです。",
    "以下の【対象論文データ】を読み、指定された【出力フォーマット】と【制約条件】に厳密に従って要約を作成してください。",
    "",
    "【制約条件】",
    "・文末は必ず「です・ます」調（敬体）で統一すること。「だ・である」調（常体）は一切使用しないこと。",
    "・一般読者にも読みやすいよう、客観的かつわかりやすい表現を用いること。",
    "・専門用語を正確に使用しつつも、論理展開が飛躍しないよう配慮すること。",
    "・各項目は2〜4文程度とし、抽象語だけで終わらせないこと。",
    "・アブストラクトに含まれる情報から、次を可能な限り具体的に書くこと：",
    "  - 調査地域・対象（国名、州、農家数、サンプル数など）",
    "  - 調査期間・データ年",
    "  - 分析手法の名称（回帰分析、DID、RCT、機械学習など）",
    "  - 主要な数値結果（%、倍率、係数の方向と意味、有意性など）",
    "  - 比較対象（処理群/対照群、導入前後、地域間差など）",
    "・数値がアブストラクトに無い場合は推測せず、「数値は論文参照」と明記すること。",
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
    "（分析から得られた具体的な結果。数値・方向・比較・政策含意を明示する）",
    "",
    "5. 図表",
    "（アブストラクトから読み取れる主要な図・表・グラフの内容。Figure/Table番号が分かれば記載。",
    "  何をプロット/集計したか、横軸・縦軸・比較対象、読み取れるメッセージを2〜3文で説明する。",
    "  図表言及が無い場合は「アブストラクトに図表の記述なし」と書く）",
    "",
    "【メディア向け見出し（一般読者向け）】",
    "学術要約とは別に、サイト一覧・カード用の短いコピーを2つ付けること。",
    "",
    "・catchTitle: 20〜32字程度。問い・対比・意外性があり、専門用語を抑えた読者向け見出し。句点で終えない。",
    "・hook: 80字以内の1文。読者が「続きを読みたい」と思う導入。です・ます調。",
    "",
    "【API出力指定】",
    "以下のキーをすべて持つJSONオブジェクト1つを出力すること（前後に説明文やコードブロック記号を付けない）。",
    "各値は必ず文字列とし、配列にしないこと。",
    "",
    "{",
    '  "titleJa": "論文タイトルの日本語訳（学術的な見出し、80字以内）",',
    '  "catchTitle": "読者向け短縮見出し（20〜32字）",',
    '  "hook": "1文フック（80字以内、です・ます調）",',
    '  "gist": "要点の文章（です・ます調）",',
    '  "novelty": "新規性の文章（です・ます調）",',
    '  "method": "手法の文章（です・ます調。対象・期間・手法名を具体的に）",',
    '  "results": "結果の文章（です・ます調。数値・比較・含意を具体的に）",',
    '  "figures": "主要図表の説明（です・ます調。2〜3文。無ければアブストラクトに図表の記述なし）"',
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
  catchTitle?: string;
  hook?: string;
};

function parseSummaryText(raw: string): GeminiSummaryResult | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<
      PaperSummary & { titleJa?: string; catchTitle?: string; hook?: string }
    >;
    if (
      typeof parsed.gist === "string" &&
      typeof parsed.novelty === "string" &&
      typeof parsed.method === "string" &&
      typeof parsed.results === "string"
    ) {
      const titleJa =
        typeof parsed.titleJa === "string" && parsed.titleJa.trim() ? parsed.titleJa.trim() : undefined;
      const catchTitle =
        typeof parsed.catchTitle === "string" && parsed.catchTitle.trim()
          ? parsed.catchTitle.trim()
          : undefined;
      const hook =
        typeof parsed.hook === "string" && parsed.hook.trim() ? parsed.hook.trim() : undefined;
      const figures =
        typeof parsed.figures === "string" && parsed.figures.trim() ? parsed.figures.trim() : undefined;
      return {
        summary: {
          gist: parsed.gist.trim(),
          novelty: parsed.novelty.trim(),
          method: parsed.method.trim(),
          results: parsed.results.trim(),
          figures,
        },
        titleJa,
        catchTitle,
        hook,
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
    gist: "要約生成に失敗しました（原文をご参照ください）",
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
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
            thinkingConfig: { thinkingBudget: 0 },
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
    } finally {
      clearTimeout(timeoutId);
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
