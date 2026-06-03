/**
 * たとえると（analogy）だけを再生成して data に保存
 * 使い方:
 *   npm run regenerate:analogy -- 2026-06-03
 *   npm run regenerate:analogy -- all
 */
import { config as loadEnv } from "dotenv";
import { readFile, readdir } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import type { ArxivPaper } from "@/lib/arxiv";
import { generateAnalogyForPaper, needsAnalogy } from "@/lib/generateAnalogy";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper } from "@/lib/types";

const DATA_DIR = "data";

function toArxiv(p: Paper): ArxivPaper {
  return {
    id: p.id,
    title: p.title,
    abstract: p.abstract,
    authors: p.authors,
    publishedAt: p.publishedAt,
    url: p.url,
    pdfUrl: p.pdfUrl,
    categories: p.categories,
    doi: p.doi,
    source: p.source,
    journal: p.journal,
    field: p.field,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function listDates(arg: string): Promise<string[]> {
  if (arg !== "all") return [arg];
  const files = await readdir(DATA_DIR);
  return files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort((a, b) => b.localeCompare(a));
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const arg = process.argv[2] ?? "all";
  const dates = await listDates(arg);
  let total = 0;

  for (const date of dates) {
    const path = `${DATA_DIR}/${date}.json`;
    const parsed = JSON.parse(await readFile(path, "utf-8")) as {
      date: string;
      papers: Paper[];
    };
    let changed = 0;

    for (let i = 0; i < (parsed.papers ?? []).length; i += 1) {
      const paper = parsed.papers[i];
      if (!needsAnalogy(paper) && process.env.FORCE_ANALOGY !== "1") continue;

      console.log(`[${date}] ${paper.id} たとえるとを生成…`);
      const analogy = await generateAnalogyForPaper(toArxiv(paper), apiKey, {
        oneLiner: paper.oneLiner ?? paper.hook,
        mechanism: paper.summary?.why,
        categoryL1: paper.categoryL1,
      });
      if (!analogy) {
        console.log("  → スキップ（生成失敗）");
        continue;
      }
      parsed.papers[i] = {
        ...paper,
        analogy,
        analogyNeedsReview: false,
        useArticleV2: true,
      };
      changed += 1;
      total += 1;
      await sleep(Number(process.env.SUMMARIZE_GAP_MS ?? 2000));
    }

    if (changed > 0) {
      await writeJsonFileAtomic(path, parsed);
      console.log(`${date}: ${changed} 件更新`);
    }
  }

  console.log(total > 0 ? `\n合計 ${total} 件の「たとえると」を生成しました。` : "更新対象はありませんでした。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
