/**
 * 既存 data/*.json の各論文に takeaway（3行）を Gemini で生成して付与する。
 * 既存要約 (gist/results/why) を素材にして、新しいAPI呼び出しはこのスクリプトのみで完結。
 * FORCE=1 で既存 takeaway も再生成。
 */
import { config as loadEnv } from "dotenv";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper, Takeaway } from "@/lib/types";

const DATA_DIR = "data";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GAP_MS = Number(process.env.BACKFILL_GAP_MS ?? 1500);

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(paper: Paper): string {
  const s = paper.summary;
  return [
    "あなたは学術論文を一般読者向けに紹介するライターです。",
    "次の論文要約から『友人にこう話せる3行テイクアウェイ』を生成してください。",
    "",
    "トーン: 少し柔らかい です・ます調（〜なんです / 〜だそうです / 〜のようです）。",
    "学術用語は言い換える。各行30〜60字。日本語の文として完結させる（体言止め可）。",
    "",
    "出力の3要素:",
    "・whatIsIt: 何を扱った研究か（背景・対象）",
    "・whatFound: 何がわかったか（主要な結論・できれば具体的な数値や比較）",
    "・soWhat: だから何なのか（読者の日常 or 社会へのつながり）",
    "",
    `タイトル: ${paper.titleJa ?? paper.title}`,
    `分野: ${paper.field ?? "不明"}`,
    "",
    "【要約素材】",
    `要点: ${s?.gist ?? ""}`,
    `新規性: ${s?.novelty ?? ""}`,
    `手法: ${s?.method ?? ""}`,
    `結果: ${s?.results ?? ""}`,
    s?.why ? `なぜそうなるのか: ${s.why}` : "",
    "",
    'JSONのみ返す: {"whatIsIt":"...","whatFound":"...","soWhat":"..."}',
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateTakeaway(paper: Paper, apiKey: string): Promise<Takeaway | null> {
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
    if (!res.ok) return null;
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Partial<Takeaway>;
    const w = typeof parsed.whatIsIt === "string" ? parsed.whatIsIt.trim() : "";
    const f = typeof parsed.whatFound === "string" ? parsed.whatFound.trim() : "";
    const so = typeof parsed.soWhat === "string" ? parsed.soWhat.trim() : "";
    if (!w || !f || !so) return null;
    const clip = (s: string) => (s.length > 120 ? `${s.slice(0, 119)}…` : s);
    return { whatIsIt: clip(w), whatFound: clip(f), soWhat: clip(so) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const force = process.env.FORCE === "1" || process.env.FORCE === "true";
  const files = (await readdir(DATA_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const raw = await readFile(filePath, "utf-8");
    if (!raw.trim()) continue;
    let parsed: { date: string; papers: Paper[] };
    try {
      parsed = JSON.parse(raw) as { date: string; papers: Paper[] };
    } catch {
      console.warn(`  ${file}: 壊れているのでスキップ`);
      continue;
    }
    const papers = parsed.papers ?? [];
    let changed = false;

    for (const paper of papers) {
      if (!force && paper.takeaway?.whatIsIt) {
        skipped += 1;
        continue;
      }
      const shortTitle = (paper.titleJa ?? paper.title).slice(0, 44);
      const t = await generateTakeaway(paper, apiKey);
      if (t) {
        paper.takeaway = t;
        changed = true;
        updated += 1;
        console.log(`  [${file}] ${shortTitle} → OK`);
      } else {
        failed += 1;
        console.log(`  [${file}] ${shortTitle} → 失敗`);
      }
      await sleep(GAP_MS);
    }

    if (changed) await writeJsonFileAtomic(filePath, parsed);
  }

  console.log(
    `\nDone. 更新 ${updated} 件 / スキップ ${skipped} 件 / 失敗 ${failed} 件` +
      (skipped > 0 && !force ? "（再生成は FORCE=1）" : "")
  );
}

main().catch((error) => {
  console.error("backfill-takeaway failed:", error);
  process.exit(1);
});
