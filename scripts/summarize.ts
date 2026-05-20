import { config as loadEnv } from "dotenv";
import { readFile, writeFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { summarizeAbstractWithGemini } from "@/lib/gemini";
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
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { date: string; papers: Paper[] };
  const papers = parsed.papers ?? [];

  const force = process.env.FORCE_SUMMARIZE === "1" || process.env.FORCE_SUMMARIZE === "true";

  const summarizedPapers: Paper[] = [];
  let skipped = 0;
  let processed = 0;
  for (const paper of papers) {
    if (!force && !needsSummarize(paper)) {
      skipped += 1;
      summarizedPapers.push(paper);
      continue;
    }

    const result = await summarizeAbstractWithGemini(toArxivPaper(paper), apiKey, 3);
    processed += 1;
    summarizedPapers.push({
      ...paper,
      titleJa: result.titleJa ?? paper.titleJa,
      summary: result.summary,
    });
    await sleep(1000);
  }

  await writeFile(
    filePath,
    JSON.stringify(
      {
        date: parsed.date ?? date,
        papers: summarizedPapers,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(
    `Done: ${processed} newly summarized, ${skipped} unchanged in ${filePath}` +
      (skipped > 0 && !force ? " (すべてやり直すときは FORCE_SUMMARIZE=1)" : "")
  );
}

main().catch((error) => {
  console.error("summarize failed:", error);
  process.exit(1);
});
