import { config as loadEnv } from "dotenv";
import { readFile, writeFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { fetchOpenAlexWorkMetrics } from "@/lib/openAlexMetrics";
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

async function main() {
  const mailto = (process.env.OPENALEX_MAILTO ?? process.env.UNPAYWALL_EMAIL ?? "").trim();
  if (!mailto) {
    throw new Error("OPENALEX_MAILTO または UNPAYWALL_EMAIL を .env.local に設定してください。");
  }

  const date = process.argv[2] ?? getTodayJstString();
  const filePath = `${DATA_DIR}/${date}.json`;
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { date: string; papers: Paper[] };
  const papers = parsed.papers ?? [];

  let updated = 0;
  for (const paper of papers) {
    if (paper.journal?.trim()) continue;

    if (paper.source === "arxiv") {
      const cat = paper.categories.find((c) => c.includes(".")) ?? paper.categories[0];
      paper.journal = cat ? `arXiv（プレプリント / ${cat}）` : "arXiv（プレプリント）";
      updated += 1;
      continue;
    }

    const metrics = await fetchOpenAlexWorkMetrics({
      doi: paper.doi,
      openAlexWorkId: /^W\d+$/i.test(paper.id) ? paper.id : undefined,
      mailto,
    });

    if (metrics.journalName) {
      paper.journal = metrics.journalName;
      updated += 1;
    }

    await sleep(300);
  }

  await writeFile(filePath, JSON.stringify({ date: parsed.date ?? date, papers }, null, 2), "utf-8");
  console.log(`Updated journal for ${updated} papers in ${filePath}`);
}

main().catch((error) => {
  console.error("backfill-journals failed:", error);
  process.exit(1);
});
