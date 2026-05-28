/**
 * 既存 data/*.json の quiz.difficulty を Gemini で推定して付与する。
 * - quiz が無い記事はスキップ
 * - すでに difficulty がある記事はスキップ（FORCE=1 で再生成）
 * - レート制限を入れる（BACKFILL_GAP_MS, デフォルト 1500ms）
 */
import { config as loadEnv } from "dotenv";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper, PredictionQuiz, QuizDifficulty } from "@/lib/types";

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

function buildPrompt(paper: Paper, quiz: PredictionQuiz): string {
  return [
    "あなたは学術論文のクイズ難易度評価者です。",
    "次の3択クイズの難易度を判定してください。",
    "",
    "判定基準:",
    "- easy: 一般常識や直感で正解しうる",
    "- medium: 分野の基礎知識があれば正解できる",
    "- hard: 論文の本文を読まないと正解しづらい / 専門知識または非自明な発見が必要",
    "",
    `論文タイトル: ${paper.titleJa ?? paper.title}`,
    `分野: ${paper.field ?? "不明"}`,
    "",
    `質問: ${quiz.question}`,
    `選択肢:\n${quiz.options.map((o, i) => `  ${i}: ${o}`).join("\n")}`,
    `正解 index: ${quiz.correctIndex}`,
    `解説: ${quiz.explanation}`,
    "",
    'JSONのみ返す: {"difficulty":"easy" | "medium" | "hard"}',
  ].join("\n");
}

async function classifyDifficulty(
  paper: Paper,
  quiz: PredictionQuiz,
  apiKey: string
): Promise<QuizDifficulty | null> {
  const endpoint = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(paper, quiz) }] }],
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
    const parsed = JSON.parse(cleaned) as { difficulty?: string };
    const v = parsed.difficulty?.trim().toLowerCase();
    if (v === "easy" || v === "medium" || v === "hard") return v;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const force = process.env.FORCE === "1" || process.env.FORCE === "true";
  const entries = await readdir(DATA_DIR);
  const dataFiles = entries
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const file of dataFiles) {
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
      if (!paper.quiz) continue;
      if (!force && paper.quiz.difficulty) {
        totalSkipped += 1;
        continue;
      }
      const shortTitle = (paper.titleJa ?? paper.title).slice(0, 48);
      process.stdout.write(`  [${file}] ${shortTitle} … `);
      const diff = await classifyDifficulty(paper, paper.quiz, apiKey);
      if (diff) {
        paper.quiz.difficulty = diff;
        changed = true;
        totalUpdated += 1;
        console.log(diff);
      } else {
        totalFailed += 1;
        console.log("失敗");
      }
      await sleep(GAP_MS);
    }

    if (changed) {
      await writeJsonFileAtomic(filePath, parsed);
    }
  }

  console.log(
    `\nDone. 更新 ${totalUpdated} 件 / スキップ ${totalSkipped} 件 / 失敗 ${totalFailed} 件` +
      (totalSkipped > 0 && !force ? "（既に difficulty 設定済みは FORCE=1 で再実行）" : "")
  );
}

main().catch((error) => {
  console.error("backfill-quiz-difficulty failed:", error);
  process.exit(1);
});
