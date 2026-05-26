import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { extractKeyFigureWithRetry } from "@/lib/extractFigure";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper } from "@/lib/types";

const DATA_DIR = "data";

function getTodayJstString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function needsFigure(paper: Paper): boolean {
  return Boolean(paper.pdfUrl?.trim() && !paper.keyFigure?.imagePath?.trim());
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const date = process.argv[2] ?? getTodayJstString();
  const filePath = `${DATA_DIR}/${date}.json`;
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    throw new Error(`${filePath} が見つかりません。先に npm run fetch を実行してください。`);
  }
  if (!raw.trim()) {
    throw new Error(`${filePath} が空です。npm run fetch で取り直してください。`);
  }

  let parsed: { date: string; papers: Paper[] };
  try {
    parsed = JSON.parse(raw) as { date: string; papers: Paper[] };
  } catch {
    throw new Error(`${filePath} が壊れています。`);
  }

  const papers = parsed.papers ?? [];
  const force = process.env.FORCE_FIGURES === "1" || process.env.FORCE_FIGURES === "true";
  const updated: Paper[] = [];
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  const toProcess = force
    ? papers.filter((p) => p.pdfUrl?.trim()).length
    : papers.filter((p) => needsFigure(p)).length;

  console.log(`図表抽出開始: ${date}（対象 ${toProcess} 件 / 全 ${papers.length} 件）`);

  async function saveProgress() {
    const remaining = papers.slice(updated.length);
    await writeJsonFileAtomic(filePath, {
      date: parsed.date ?? date,
      papers: [...updated, ...remaining],
    });
  }

  for (const paper of papers) {
    if (!force && !needsFigure(paper)) {
      skipped += 1;
      updated.push(paper);
      continue;
    }

    if (!paper.pdfUrl?.trim()) {
      skipped += 1;
      updated.push(paper);
      continue;
    }

    const label = paper.titleJa ?? paper.title;
    const shortTitle = label.length > 48 ? `${label.slice(0, 48)}…` : label;
    console.log(`[${processed + 1}/${toProcess}] 図表抽出: ${shortTitle}`);
    const started = Date.now();

    const keyFigure = await extractKeyFigureWithRetry(paper, apiKey, 2);
    processed += 1;

    if (keyFigure) {
      updated.push({ ...paper, keyFigure });
      console.log(`  → 完了 (${((Date.now() - started) / 1000).toFixed(1)}s) p.${keyFigure.page}`);
    } else {
      failed += 1;
      updated.push(force ? { ...paper, keyFigure: undefined } : paper);
      console.log(`  → スキップ（PDF取得または図表選定に失敗）`);
    }

    await saveProgress();
    await sleep(800);
  }

  console.log(
    `Done: ${processed} 件処理, 成功 ${processed - failed}, 失敗 ${failed}, スキップ ${skipped} in ${filePath}` +
      (skipped > 0 && !force ? " (すべてやり直すときは FORCE_FIGURES=1)" : "")
  );
}

main().catch((error) => {
  console.error("extract-figures failed:", error);
  process.exit(1);
});
