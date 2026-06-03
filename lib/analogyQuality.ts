const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export type AnalogyQualityVerdict = {
  ok: boolean;
  isAgriContext: boolean;
  hasMapping: boolean;
  withinLength: boolean;
  reason?: string;
};

function parseVerdictJson(raw: string): AnalogyQualityVerdict | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    return {
      ok: o.ok === true,
      isAgriContext: o.is_agri_context === true,
      hasMapping: o.has_mapping === true,
      withinLength: o.within_length !== false,
      reason: typeof o.reason === "string" ? o.reason : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 比喩品質の自動評価（評価 LLM）。
 * NG なら呼び出し側で再生成（最大2回）。
 */
export async function evaluateAnalogyQuality(
  analogyTitle: string,
  analogyBody: string,
  apiKey: string
): Promise<AnalogyQualityVerdict> {
  if (!analogyBody.trim()) {
    return { ok: false, isAgriContext: false, hasMapping: false, withinLength: true, reason: "empty" };
  }

  const prompt = [
    "あなたは農業経済メディアの編集者です。次の比喩を評価し JSON のみ返してください。",
    "{",
    '  "ok": true/false,',
    '  "is_agri_context": 農業・畑・収穫・天候・市場・流通・農機・品種など農業文脈が主か,',
    '  "has_mapping": 「〜のようなもの」だけで終わらず対応関係が明示されているか,',
    '  "within_length": 200字以内か,',
    '  "reason": "NG理由（任意）"',
    "}",
    "",
    `タイトル: ${analogyTitle}`,
    `本文: ${analogyBody}`,
  ].join("\n");

  const endpoint = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    return {
      ok: true,
      isAgriContext: true,
      hasMapping: true,
      withinLength: analogyBody.length <= 200,
      reason: "eval-skipped",
    };
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return (
    parseVerdictJson(text) ?? {
      ok: analogyBody.length <= 200 && analogyBody.length >= 40,
      isAgriContext: /農|畑|作物|収穫|畜産|食料|市場/.test(analogyBody),
      hasMapping: /ように|たとえ|イメージ|対応/.test(analogyBody),
      withinLength: analogyBody.length <= 200,
    }
  );
}
