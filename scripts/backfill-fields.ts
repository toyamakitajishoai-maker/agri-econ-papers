/**
 * 既存 data/*.json の field を再推定する。
 * ステップ:
 *   1) categories から arXiv カテゴリ → FETCH_TOPICS の何かにマッチすればその labelJa を採用
 *   2) それでも決まらなければ Gemini に「タイトル+アブストラクトからどの分野か」を1問だけ投げる
 *
 * 旧データで「field 未設定」「全部開発経済になっている」等を是正する。
 * FORCE=1 で既に field がある記事も再判定。
 */
import { config as loadEnv } from "dotenv";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

import { FETCH_TOPICS } from "@/lib/fetchTopics";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper } from "@/lib/types";

const DATA_DIR = "data";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GAP_MS = Number(process.env.BACKFILL_GAP_MS ?? 1200);

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TOPIC_IDS = FETCH_TOPICS.map((t) => t.id);
const TOPIC_LABEL_BY_ID = Object.fromEntries(FETCH_TOPICS.map((t) => [t.id, t.labelJa]));

async function inferFromGemini(paper: Paper, apiKey: string): Promise<string | null> {
  const endpoint = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const prompt = [
    "次の論文を、提示された分野IDのいずれか1つに分類してください。",
    "論文の中心的なテーマと方法論に最もよく合うものを選ぶこと。",
    "農業や経済の語が含まれていても、主題がAI・ファイナンス・神経科学・歴史 等であれば必ずそちらを選ぶ。",
    "提示されたどれにも明らかに当てはまらなければ topicId に 'other' を返す。",
    "",
    `分野ID → 日本語ラベル:`,
    ...FETCH_TOPICS.map((t) => `  ${t.id} = ${t.labelJa}`),
    "  other = その他",
    "",
    `タイトル: ${paper.titleJa ?? paper.title}`,
    `アブストラクト: ${(paper.abstract ?? "").slice(0, 1200)}`,
    "",
    `分野ID は次のいずれか: ${TOPIC_IDS.join(", ")}, other`,
    'JSONのみ返す: {"topicId":"<上記IDのどれか>"}',
  ].join("\n");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
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
    const parsed = JSON.parse(cleaned) as { topicId?: string };
    const id = parsed.topicId?.trim();
    if (!id) return null;
    if (id === "other") return "その他";
    return TOPIC_LABEL_BY_ID[id] ?? null;
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
      const had = Boolean(paper.field?.trim());
      if (had && !force) {
        skipped += 1;
        continue;
      }
      const shortTitle = (paper.titleJa ?? paper.title).slice(0, 44);

      /** AI 推定に一本化：カテゴリ推定は誤判定が多いため廃止 */
      const fromAi = await inferFromGemini(paper, apiKey);
      if (fromAi) {
        if (paper.field !== fromAi) {
          paper.field = fromAi;
          changed = true;
        }
        updated += 1;
        console.log(`  [${file}] ${shortTitle} → ${fromAi}`);
      } else {
        failed += 1;
        console.log(`  [${file}] ${shortTitle} → 推定失敗`);
      }
      await sleep(GAP_MS);
    }

    if (changed) await writeJsonFileAtomic(filePath, parsed);
  }

  console.log(
    `\nDone. 更新 ${updated} 件 / スキップ ${skipped} 件 / 失敗 ${failed} 件` +
      (skipped > 0 && !force ? "（再判定したい場合は FORCE=1）" : "")
  );
}

main().catch((error) => {
  console.error("backfill-fields failed:", error);
  process.exit(1);
});
