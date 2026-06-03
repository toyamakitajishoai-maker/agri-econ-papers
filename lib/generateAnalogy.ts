import type { ArxivPaper } from "@/lib/arxiv";
import { evaluateAnalogyQuality } from "@/lib/analogyQuality";
import { classifyPaper } from "@/lib/classifyPaper";
import type { AnalogyBlock, AnalogyDomain, CategoryL1 } from "@/lib/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type AnalogyJson = {
  title?: string;
  body?: string;
  domain?: string;
};

function parseAnalogyJson(raw: unknown): AnalogyBlock | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as AnalogyJson;
  const title = typeof a.title === "string" ? a.title.trim() : "";
  const body = typeof a.body === "string" ? a.body.trim() : "";
  if (!title || !body || body.length < 50) return undefined;
  const domains = new Set(["farming", "cooking", "market", "weather", "daily", "other"]);
  const domain = domains.has(String(a.domain)) ? (a.domain as AnalogyDomain) : undefined;
  return { title, body, ...(domain ? { domain } : {}) };
}

function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGemini(prompt: string, apiKey: string, temperature = 0.55): Promise<string> {
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
    throw new Error(`Gemini error: ${response.status}`);
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export function needsAnalogy(paper: {
  analogy?: AnalogyBlock;
  analogyNeedsReview?: boolean;
}): boolean {
  if (paper.analogyNeedsReview) return true;
  const body = paper.analogy?.body?.trim() ?? "";
  const title = paper.analogy?.title?.trim() ?? "";
  return !body || !title || body.length < 50;
}

function buildAnalogyPrompt(
  paper: ArxivPaper,
  ctx: {
    categoryL1: CategoryL1;
    oneLiner?: string;
    mechanism?: string;
    feedback?: string;
  }
): string {
  const slot = ctx.categoryL1;
  const agriFirst =
    slot === "agri-econ"
      ? "必ず農業・食料システムの場面（畑・農家・市場・収穫・天候・契約・畜産など）で始めてください。"
      : slot === "adjacent"
        ? "農業経済に応用できる比喩を最優先。難しければ市場・契約・家計・天候の身近な場面で。"
        : "農業経済への応用が伝わる比喩にしてください（手法の輸入・データの扱いなど）。";

  return [
    "あなたは農業経済メディアの編集者です。論文の「たとえると」セクションだけを生成してください。",
    "手編集は不要です。読者が「なるほど」と思える比喩を、必ず生成してください。",
    "",
    "【対象】",
    `タイトル: ${paper.title}`,
    `分野: ${paper.field ?? "不明"}`,
    ctx.oneLiner ? `ひとこと要約: ${ctx.oneLiner}` : "",
    ctx.mechanism ? `メカニズム（参考）: ${ctx.mechanism.slice(0, 400)}` : "",
    `アブストラクト: ${paper.abstract.slice(0, 1200)}`,
    "",
    "【たとえるとの書き方】",
    agriFirst,
    "- title: 12〜28字。比喩の核心が一目で分かる見出し（例: 「収穫前の天候判断のようなもの」）",
    "- body: 130〜190字。です・ます調。次の3段構成:",
    "  1) 読者がイメージできる具体場面（農業・市場・家計など）",
    "  2) 「これは研究の〇〇（手法・結果・仕組み）に対応します」と明示",
    "  3) 読者の納得を促す一文",
    "- 禁止: 「〜のようなものです」だけで終わる、研究との対応が不明、抽象語だけの羅列",
    ctx.feedback ? `\n【前回の改善点】\n${ctx.feedback}` : "",
    "",
    "【出力JSON】",
    '{ "title": "...", "body": "...", "domain": "farming|cooking|market|weather|daily|other" }',
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 比喩ブロックのみを Gemini で生成（最大3回まで品質チェック付き）。
 */
export async function generateAnalogyForPaper(
  paper: ArxivPaper,
  apiKey: string,
  ctx: {
    oneLiner?: string;
    mechanism?: string;
    categoryL1?: CategoryL1;
  } = {}
): Promise<AnalogyBlock | undefined> {
  const categoryL1 =
    ctx.categoryL1 ??
    classifyPaper({
      categories: paper.categories,
      abstract: paper.abstract,
      title: paper.title,
      field: paper.field,
    }).categoryL1;

  let best: AnalogyBlock | undefined;
  let feedback: string | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const prompt = buildAnalogyPrompt(paper, {
      categoryL1,
      oneLiner: ctx.oneLiner,
      mechanism: ctx.mechanism,
      feedback,
    });
    const raw = await callGemini(prompt, apiKey, 0.5 + attempt * 0.05);
    const parsed = parseAnalogyJson(extractJson(raw));
    if (!parsed) {
      feedback = "title と body を必ず含め、50字以上の body を書いてください。";
      continue;
    }
    best = parsed;

    const verdict = await evaluateAnalogyQuality(parsed.title, parsed.body, apiKey);
    if (verdict.ok || verdict.reason === "eval-skipped") {
      return parsed;
    }
    feedback = [
      verdict.reason,
      !verdict.hasMapping ? "研究との対応関係を明示してください。" : "",
      !verdict.isAgriContext ? "農業・食料・市場など身近な場面を入れてください。" : "",
      !verdict.withinLength ? "200字以内に収めてください。" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return best;
}
