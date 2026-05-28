import type { ArxivPaper } from "@/lib/arxiv";
import type { GlossaryTerm, PaperSummary, PredictionQuiz, StoryCards, Takeaway } from "@/lib/types";

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

function buildPrompt(paper: ArxivPaper, pdfExcerpt?: string | null): string {
  const abstractRaw = paper.abstract.trim() || "";
  const abstractForModel = abstractRaw
    ? decodeBasicEntities(abstractRaw)
    : "（公開アブストラクトなし。タイトルと著者情報から内容を推定して要約すること。）";
  const hasPdf = Boolean(pdfExcerpt?.trim());
  const sourceNote = hasPdf
    ? "アブストラクトと【論文本文抜粋】の両方を根拠にすること。抜粋に書かれている因果・メカニズムを優先すること。"
    : "根拠はアブストラクトのみ。本文に無い因果は推測しないこと。";

  return [
    "あなたは学術論文に精通したリサーチャーです。分野（農業経済・環境・健康・開発など）に応じて適切な用語で説明してください。",
    "以下の【対象論文データ】を読み、指定された【出力フォーマット】と【制約条件】に厳密に従って要約を作成してください。",
    "",
    "【情報源】",
    sourceNote,
    "",
    "【制約条件】",
    "・文末は必ず「です・ます」調（敬体）で統一すること。「だ・である」調（常体）は一切使用しないこと。",
    "・一般読者にも読みやすいよう、客観的かつわかりやすい表現を用いること。",
    "・専門用語を正確に使用しつつも、論理展開が飛躍しないよう配慮すること。",
    "・各項目は2〜5文程度とし、抽象語だけで終わらせないこと。",
    "・「XがYを改善する」だけで終わらせず、可能なら「なぜそうなるのか」まで説明すること（因果の連鎖、仲介要因、比較群の違い、制度・市場・技術の経路）。",
    "・提供テキストに含まれる情報から、次を可能な限り具体的に書くこと：",
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
    "5. なぜそうなるのか（why）",
    "（結果の背景にある因果・メカニズムを、一般読者向けに説明する。",
    "  例：畜産が経済安定性を高めるのはなぜか → 収入源の分散、価格リスク、労働配分、市場アクセスなど、論文が示す経路を順に説明。",
    "  根拠に無い推測はせず、不明な点は「本要約の範囲では不明」と書く）",
    "",
    "6. 図表",
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
    "【エデュテインメント（読者参加）】",
    "・quiz: 記事を読む前に答える3択の予想クイズ。",
    "  - question: 論文の結論を問う質問（です・ます調）",
    "  - options: 選択肢3つ（文字列の配列）。1つが正解、残り2つは『一見もっともらしいが論文の結論とは異なる誤答』を作る。極端な誤答（明らかに荒唐無稽）は避ける。",
    "  - correctIndex: 正解のインデックス（0始まり）",
    "  - explanation: 正解の理由を2文以内（です・ます調）",
    "  - difficulty: 'easy' | 'medium' | 'hard' のいずれか。",
    "      easy=直感的に正解できる / medium=分野の知識があると正解できる / hard=論文を読まないと正解しづらい",
    "・limitations: 研究の限界・制約（PDF本文抜粋に該当記述がある場合のみ）",
    "  - Limitations / Discussion / Conclusion などで著者が述べた限界を、日本語2〜5文で要約",
    "  - サンプルサイズ・一般化可能性・データ欠損・因果推論の限界など、論文に書かれた内容に限定",
    "  - PDF抜粋に限界の記述が無い場合は空文字 \"\"（推測や創作はしない）",
    "  - PDF抜粋が無い場合も空文字 \"\"",
    "",
    "【友人に話せる3行テイクアウェイ（takeaway）】",
    "・記事を読んだ人が、友人に「ねぇ知ってる？」と話したくなる3行を作る。",
    "・トーンは『少し柔らかい です・ます調』（例: 〜なんです / 〜だそうです / 〜のようです）。サイト全体の上品さは保ち、軽口は避ける。",
    "・各行は30〜60字。冗長な学術用語は使わず、専門用語は言い換える。",
    "・whatIsIt: 何を扱った研究か（背景・対象が分かる）",
    "・whatFound: 何がわかったか（結論・主要な数値や比較を一つ）",
    "・soWhat: だから何なのか（読者の日常 or 社会へのつながり）",
    "・各行は必ず日本語の文として完結させる（体言止め可、ただし主語と述語が読み取れること）。",
    "",
    "【4枚図解カード（storyCards）— Instagram / X 用の縦型画像に載る短文】",
    "・各カード25〜45字。1文で完結。体言止め・問いかけ・数字を積極的に使う。",
    "・煽り・誇張は禁止。です・ます調は不要（見出し風の短い日本語でOK）。",
    "・ask: 読者が「え、そうなの？」と止まる問い（具体例1つ入れると良い）",
    "・method: 調べ方を動詞で一言（「〜と比べて料金を計算する」など）",
    "・finding: 結論を断言（数値・固有名詞があれば1つ）",
    "・meaning: だから何か（将来の用途＋「実装はこれから」など期待値の線引きも可）",
    "",
    "【専門用語の解説（glossary）】",
    "・要約本文（gist / novelty / method / results / why）に登場する専門用語を最大8件まで抽出し、",
    "  一般読者にも分かるように1〜2文で解説してください。",
    "・term: 要約本文に **そのままの表記** で登場する語（日本語表記または日本語＋括弧の英略）を使用すること。",
    "  - 例: \"差の差分析（DID）\"、\"バックテスト\"、\"単峰性\"、\"プロビット回帰\"",
    "・reading: 任意。別表記や英略があれば書く（例 \"Difference-in-Differences\"）",
    "・definition: 中学生でも何となく分かる平易な日本語で2文以内。比喩はOK、論文の文脈に沿った意味を優先。",
    "・term は要約本文中に実際に登場する語のみ。本文に無い語は含めないこと。",
    "・一般用語（GDP・地球温暖化・回帰など読者がほぼ知っている語）は除外。専門的でつまずく語を優先。",
    "",
    "【API出力指定】",
    "以下のキーをすべて持つJSONオブジェクト1つを出力すること（前後に説明文やコードブロック記号を付けない）。",
    "quiz.options は文字列の配列とすること。",
    "",
    "{",
    '  "titleJa": "論文タイトルの日本語訳（学術的な見出し、80字以内）",',
    '  "catchTitle": "読者向け短縮見出し（20〜32字）",',
    '  "hook": "1文フック（80字以内、です・ます調）",',
    '  "gist": "要点の文章（です・ます調）",',
    '  "novelty": "新規性の文章（です・ます調）",',
    '  "method": "手法の文章（です・ます調。対象・期間・手法名を具体的に）",',
    '  "results": "結果の文章（です・ます調。数値・比較・含意を具体的に）",',
    '  "why": "なぜそうなるのか（因果・メカニズム。3〜5文。です・ます調）",',
    '  "figures": "主要図表の説明（です・ます調。2〜3文。無ければ図表の記述なし）",',
    '  "quiz": {',
    '    "question": "予想クイズの質問",',
    '    "options": ["選択肢A", "選択肢B", "選択肢C"],',
    '    "correctIndex": 0,',
    '    "explanation": "正解の解説",',
    '    "optionExplanations": ["Aを選んだときの解説", "Bを選んだときの解説", "Cを選んだときの解説"],',
    '    "difficulty": "easy | medium | hard のいずれか"',
    "  },",
    '  "takeaway": {',
    '    "whatIsIt": "何を扱った研究か（30〜60字）",',
    '    "whatFound": "何がわかったか（30〜60字）",',
    '    "soWhat": "だから何なのか（30〜60字）"',
    "  },",
    '  "storyCards": {',
    '    "ask": "問い（25〜45字・SNS用短文）",',
    '    "method": "手法（25〜45字）",',
    '    "finding": "発見（25〜45字）",',
    '    "meaning": "意味（25〜45字）"',
    "  },",
    '  "limitations": "研究の限界（該当記述がある場合のみ。無ければ空文字）",',
    '  "glossary": [',
    '    { "term": "本文中に登場する専門用語", "reading": "別表記（任意）", "definition": "平易な日本語の解説1〜2文" }',
    "  ]",
    "}",
    "",
    "【対象論文データ】",
    `タイトル: ${paper.title}`,
    `著者: ${paper.authors.join(", ") || "不明"}`,
    `アブストラクト:\n${abstractForModel}`,
    ...(hasPdf
      ? [
          "",
          "【論文本文抜粋（PDFから自動取得・Introduction/Results/Discussion等）】",
          pdfExcerpt!.trim(),
        ]
      : []),
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
  quiz?: PredictionQuiz;
  /** PDFに限界の記述がある場合のみ。無ければ空文字 */
  limitations?: string;
  glossary?: GlossaryTerm[];
  takeaway?: Takeaway;
  storyCards?: StoryCards;
};

function parseDifficulty(raw: unknown): PredictionQuiz["difficulty"] {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "easy" || v === "medium" || v === "hard") return v;
  return undefined;
}

function parseQuiz(raw: unknown): PredictionQuiz | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const q = raw as Partial<PredictionQuiz>;
  if (typeof q.question !== "string" || !Array.isArray(q.options)) return undefined;
  const options = q.options.filter((o): o is string => typeof o === "string").slice(0, 3);
  const correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : 0;
  const explanation = typeof q.explanation === "string" ? q.explanation.trim() : "";
  if (options.length < 2 || !q.question.trim() || !explanation) return undefined;
  const difficulty = parseDifficulty((q as { difficulty?: unknown }).difficulty);
  return {
    question: q.question.trim(),
    options,
    correctIndex: Math.min(options.length - 1, Math.max(0, correctIndex)),
    explanation,
    ...(difficulty ? { difficulty } : {}),
  };
}

const LIMITATIONS_EMPTY_MARKERS = [
  "記述なし",
  "見当たりません",
  "明示的な記述はない",
  "該当なし",
  "なし",
  "not mentioned",
  "no explicit",
];

function parseStoryCards(raw: unknown): StoryCards | undefined {
  let obj: unknown = raw;
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object") {
    obj = raw[0];
  }
  if (!obj || typeof obj !== "object") return undefined;
  const s = obj as Partial<StoryCards>;
  const ask = typeof s.ask === "string" ? s.ask.trim() : "";
  const method = typeof s.method === "string" ? s.method.trim() : "";
  const finding = typeof s.finding === "string" ? s.finding.trim() : "";
  const meaning = typeof s.meaning === "string" ? s.meaning.trim() : "";
  if (!ask || !method || !finding || !meaning) return undefined;
  const clip = (t: string) => (t.length > 100 ? `${t.slice(0, 99)}…` : t);
  return { ask: clip(ask), method: clip(method), finding: clip(finding), meaning: clip(meaning) };
}

function parseTakeaway(raw: unknown): Takeaway | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Partial<Takeaway>;
  const what = typeof t.whatIsIt === "string" ? t.whatIsIt.trim() : "";
  const found = typeof t.whatFound === "string" ? t.whatFound.trim() : "";
  const so = typeof t.soWhat === "string" ? t.soWhat.trim() : "";
  if (!what || !found || !so) return undefined;
  /** 長すぎる行は安全側で 120 字に切り詰め */
  const clip = (s: string) => (s.length > 120 ? `${s.slice(0, 119)}…` : s);
  return { whatIsIt: clip(what), whatFound: clip(found), soWhat: clip(so) };
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
    const reading = typeof e.reading === "string" ? e.reading.trim() : "";
    items.push({
      term,
      definition,
      ...(reading ? { reading } : {}),
    });
    if (items.length >= 12) break;
  }
  return items.length > 0 ? items : undefined;
}

function parseLimitations(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const text = raw.trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (LIMITATIONS_EMPTY_MARKERS.some((m) => lower.includes(m.toLowerCase()))) return "";
  return text;
}

function extractJsonObjectText(raw: string): string {
  let cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
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
      // continue
    }
  }
  return null;
}

function parseSummaryText(raw: string): GeminiSummaryResult | null {
  const parsed = parseJsonLoose(raw) as Partial<
    PaperSummary & {
      titleJa?: string;
      catchTitle?: string;
      hook?: string;
      quiz?: unknown;
      limitations?: unknown;
    }
  > | null;

  if (!parsed) return null;

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
    const why = typeof parsed.why === "string" && parsed.why.trim() ? parsed.why.trim() : undefined;
    return {
      summary: {
        gist: parsed.gist.trim(),
        novelty: parsed.novelty.trim(),
        method: parsed.method.trim(),
        results: parsed.results.trim(),
        why,
        figures,
      },
      titleJa,
      catchTitle,
      hook,
      quiz: parseQuiz(parsed.quiz),
      limitations: parseLimitations(parsed.limitations),
      glossary: parseGlossary((parsed as { glossary?: unknown }).glossary),
      takeaway: parseTakeaway((parsed as { takeaway?: unknown }).takeaway),
      storyCards: parseStoryCards((parsed as { storyCards?: unknown }).storyCards),
    };
  }
  return null;
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
  retryCount = 3,
  pdfExcerpt?: string | null
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
              parts: [{ text: buildPrompt(paper, pdfExcerpt) }],
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
