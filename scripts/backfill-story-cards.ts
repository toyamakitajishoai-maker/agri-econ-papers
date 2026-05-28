/**
 * 既存論文に storyCards（4枚図解）を Gemini で付与する。
 * 要約本文を素材にするため、全文の再要約は不要。
 */
import { config as loadEnv } from "dotenv";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper, StoryCards } from "@/lib/types";

const DATA_DIR = "data";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GAP_MS = Number(process.env.BACKFILL_GAP_MS ?? 1500);

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

function buildPrompt(paper: Paper): string {
  const s = paper.summary;
  return [
    "あなたは学術論文を一般読者向けに紹介するライターです。",
    "次の要約から、Instagram / X 用の縦型画像4枚に載る短文を作ってください。",
    "",
    "トーン: 短く印象的。煽り・誇張は禁止。各25〜45字、1文で完結。",
    "",
    "・ask: 読者が止まる問い（具体例があれば入れる）",
    "・method: 調べ方を動詞で一言",
    "・finding: 結論を断言",
    "・meaning: だから何か（期待値の線引きも可）",
    "",
    `タイトル: ${paper.catchTitle ?? paper.titleJa ?? paper.title}`,
    `分野: ${paper.field ?? "不明"}`,
    "",
    "【要約素材】",
    `要点: ${s?.gist ?? ""}`,
    `手法: ${s?.method ?? ""}`,
    `結果: ${s?.results ?? ""}`,
    s?.why ? `なぜ: ${s.why}` : "",
    paper.takeaway
      ? `テイクアウェイ: ${paper.takeaway.whatIsIt} / ${paper.takeaway.whatFound} / ${paper.takeaway.soWhat}`
      : "",
    "",
    'JSONのみ: {"ask":"...","method":"...","finding":"...","meaning":"..."}',
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateStoryCards(paper: Paper, apiKey: string): Promise<StoryCards | null> {
  const endpoint = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(paper) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`  API ${res.status}: ${err.slice(0, 120)}`);
      return null;
    }
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text.trim()) {
      console.warn("  空レスポンス");
      return null;
    }
    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(extractJsonObjectText(text));
    } catch {
      /** 配列で返る場合のフォールバック */
      const arrStart = text.indexOf("[");
      const arrEnd = text.lastIndexOf("]");
      if (arrStart >= 0 && arrEnd > arrStart) {
        try {
          rawParsed = JSON.parse(text.slice(arrStart, arrEnd + 1));
        } catch {
          console.warn(`  JSON解析失敗: ${text.slice(0, 80)}…`);
          return null;
        }
      } else {
        console.warn(`  JSON解析失敗: ${text.slice(0, 80)}…`);
        return null;
      }
    }
    let parsed: Partial<StoryCards>;
    if (Array.isArray(rawParsed) && rawParsed.length > 0 && typeof rawParsed[0] === "object") {
      parsed = rawParsed[0] as Partial<StoryCards>;
    } else if (rawParsed && typeof rawParsed === "object") {
      parsed = rawParsed as Partial<StoryCards>;
    } else {
      return null;
    }
    const ask = typeof parsed.ask === "string" ? parsed.ask.trim() : "";
    const method = typeof parsed.method === "string" ? parsed.method.trim() : "";
    const finding = typeof parsed.finding === "string" ? parsed.finding.trim() : "";
    const meaning = typeof parsed.meaning === "string" ? parsed.meaning.trim() : "";
    if (!ask || !method || !finding || !meaning) return null;
    const clip = (x: string) => (x.length > 100 ? `${x.slice(0, 99)}…` : x);
    return { ask: clip(ask), method: clip(method), finding: clip(finding), meaning: clip(meaning) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");

  const force = process.env.FORCE_STORY === "1" || process.env.FORCE_STORY === "true";
  const files = (await readdir(DATA_DIR))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  let total = 0;
  let ok = 0;
  let skip = 0;

  for (const fname of files) {
    const filePath = path.join(DATA_DIR, fname);
    const raw = await readFile(filePath, "utf-8");
    if (!raw.trim()) continue;
    const parsed = JSON.parse(raw) as { date: string; papers: Paper[] };
    let changed = false;

    for (let i = 0; i < (parsed.papers ?? []).length; i += 1) {
      const paper = parsed.papers[i];
      total += 1;
      if (!force && paper.storyCards?.ask) {
        skip += 1;
        continue;
      }
      const label = (paper.catchTitle ?? paper.titleJa ?? paper.title).slice(0, 40);
      console.log(`[${fname}] ${label}`);
      const cards = await generateStoryCards(paper, apiKey);
      if (cards) {
        parsed.papers[i] = { ...paper, storyCards: cards };
        changed = true;
        ok += 1;
        console.log(`  ✓ 4枚生成`);
      } else {
        console.log(`  ✗ 失敗`);
      }
      await sleep(GAP_MS);
    }

    if (changed) {
      await writeJsonFileAtomic(filePath, parsed);
    }
  }

  console.log(`---\nDone: ${ok} generated, ${skip} skipped, ${total} total`);
}

main().catch((e) => {
  console.error("backfill-story-cards failed:", e);
  process.exit(1);
});
