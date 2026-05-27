import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { summarizeAbstractWithGemini } from "@/lib/gemini";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import { isAcademicSummary } from "@/lib/summary";
import type { ArxivPaper } from "@/lib/arxiv";
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

function toArxivPaper(paper: Paper): ArxivPaper {
  return {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract,
    authors: paper.authors,
    publishedAt: paper.publishedAt,
    url: paper.url,
    pdfUrl: paper.pdfUrl,
    categories: paper.categories,
    doi: paper.doi,
    source: paper.source,
    journal: paper.journal,
  };
}

/** fetch 直後・旧形式・失敗時は要約が必要 */
function needsSummarize(paper: Paper): boolean {
  const s = paper.summary;
  if (!isAcademicSummary(s)) return true;

  const { gist, novelty, results } = s;
  if (gist === "要約準備中") return true;
  if (gist.startsWith("要約生成に失敗")) return true;
  if (gist.startsWith("同分野の新着")) return true;
  if (!paper.catchTitle?.trim() || !paper.hook?.trim()) return true;
  if (!s.figures?.trim()) return true;
  if (!paper.quiz?.question) return true;
  if (!paper.evidence?.level) return true;
  if (paper.abstract && (novelty === paper.abstract || results === paper.abstract)) return true;
  return false;
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
    throw new Error(
      `${filePath} が空です（保存途中で止まった可能性があります）。npm run fetch で取り直してください。`
    );
  }
  let parsed: { date: string; papers: Paper[] };
  try {
    parsed = JSON.parse(raw) as { date: string; papers: Paper[] };
  } catch {
    throw new Error(`${filePath} が壊れています。npm run fetch で取り直してください。`);
  }
  const papers = parsed.papers ?? [];

  const force = process.env.FORCE_SUMMARIZE === "1" || process.env.FORCE_SUMMARIZE === "true";

  const summarizedPapers: Paper[] = [];
  let skipped = 0;
  let processed = 0;
  const toProcess = force ? papers.length : papers.filter((p) => needsSummarize(p)).length;

  console.log(`要約開始: ${date}（対象 ${toProcess} 件 / 全 ${papers.length} 件）`);

  async function saveProgress() {
    const remaining = papers.slice(summarizedPapers.length);
    await writeJsonFileAtomic(filePath, {
      date: parsed.date ?? date,
      papers: [...summarizedPapers, ...remaining],
    });
  }

  for (let i = 0; i < papers.length; i += 1) {
    const paper = papers[i];

    if (!force && !needsSummarize(paper)) {
      skipped += 1;
      summarizedPapers.push(paper);
      continue;
    }

    const label = paper.titleJa ?? paper.title;
    const shortTitle = label.length > 48 ? `${label.slice(0, 48)}…` : label;
    console.log(`[${processed + 1}/${toProcess}] 要約中: ${shortTitle}`);
    const started = Date.now();

    const result = await summarizeAbstractWithGemini(toArxivPaper(paper), apiKey, 3);
    processed += 1;
    summarizedPapers.push({
      ...paper,
      titleJa: result.titleJa ?? paper.titleJa,
      catchTitle: result.catchTitle ?? paper.catchTitle,
      hook: result.hook ?? paper.hook,
      quiz: result.quiz ?? paper.quiz,
      evidence: result.evidence ?? paper.evidence,
      summary: result.summary,
    });

    const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`  → 完了 (${elapsedSec}s) catchTitle: ${result.catchTitle ? "あり" : "なし"}`);

    await saveProgress();
    await sleep(1000);
  }

  console.log(
    `Done: ${processed} newly summarized, ${skipped} unchanged in ${filePath}` +
      (skipped > 0 && !force ? " (すべてやり直すときは FORCE_SUMMARIZE=1)" : "")
  );
}

main().catch((error) => {
  console.error("summarize failed:", error);
  process.exit(1);
});
