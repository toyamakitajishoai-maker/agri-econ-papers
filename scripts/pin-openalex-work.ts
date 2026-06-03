/**
 * OpenAlex の1論文を指定日の data/YYYY-MM-DD.json に差し込む（ローカルで作った記事を本番に合わせる用）。
 *
 * 例: tsx scripts/pin-openalex-work.ts W7162751758 2026-06-01 --replace 2605.30166v1
 */
import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { classifyPaper } from "@/lib/classifyPaper";
import { topicById } from "@/lib/fetchTopics";
import { fetchOpenAlexWorkById } from "@/lib/openAlex";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper } from "@/lib/types";

const DATA_DIR = "data";

function emptySummary(abstract: string) {
  return {
    gist: "要約準備中",
    novelty: abstract,
    method: abstract,
    results: abstract,
  };
}

function tagAgriEcon(paper: Paper): Paper {
  const topic = topicById("agri-econ");
  if (!topic) return paper;
  return {
    ...paper,
    field: topic.labelJa,
    categories: [`topic:agri-econ`, ...paper.categories.filter((c) => !c.startsWith("topic:"))],
  };
}

async function main() {
  const workId = process.argv[2];
  const date = process.argv[3];
  const replaceFlag = process.argv.indexOf("--replace");
  const replaceId = replaceFlag >= 0 ? process.argv[replaceFlag + 1] : undefined;

  if (!workId || !date) {
    console.error("Usage: tsx scripts/pin-openalex-work.ts <OpenAlexId> <YYYY-MM-DD> [--replace <paperId>]");
    process.exit(1);
  }

  const mailto = (process.env.OPENALEX_MAILTO ?? process.env.UNPAYWALL_EMAIL ?? "").trim();
  if (!mailto) {
    console.error("OPENALEX_MAILTO または UNPAYWALL_EMAIL を .env.local に設定してください。");
    process.exit(1);
  }

  const raw = await fetchOpenAlexWorkById(mailto, workId);
  if (!raw) {
    console.error("OpenAlex から論文を取得できませんでした。");
    process.exit(1);
  }

  const c = classifyPaper({
    categories: raw.categories,
    abstract: raw.abstract,
    title: raw.title,
    field: "農業経済",
  });

  let incoming: Paper = tagAgriEcon({
    id: raw.id,
    title: raw.title,
    authors: raw.authors,
    publishedAt: raw.publishedAt,
    url: raw.url,
    pdfUrl: raw.pdfUrl,
    categories: raw.categories,
    abstract: raw.abstract,
    summary: emptySummary(raw.abstract),
    doi: raw.doi,
    source: raw.source ?? "openalex",
    journal: raw.journal,
    field: "農業経済",
    categoryL1: c.categoryL1,
    categoryL2: c.categoryL2,
    arxivPrimary: c.arxivPrimary,
  });

  const filePath = `${DATA_DIR}/${date}.json`;
  let payload: { date: string; papers: Paper[] };
  try {
    const text = await readFile(filePath, "utf-8");
    payload = JSON.parse(text) as { date: string; papers: Paper[] };
  } catch {
    payload = { date, papers: [] };
  }

  if (replaceId) {
    const idx = payload.papers.findIndex((p) => p.id === replaceId);
    if (idx < 0) {
      console.error(`置換対象 ${replaceId} が ${filePath} にありません。`);
      process.exit(1);
    }
    payload.papers[idx] = incoming;
    console.log(`置換: ${replaceId} → ${incoming.id} (${incoming.title.slice(0, 60)}…)`);
  } else if (payload.papers.some((p) => p.id === incoming.id)) {
    incoming = payload.papers.find((p) => p.id === incoming.id)!;
    console.log(`既に同じ ID があります: ${incoming.id}`);
  } else {
    payload.papers.unshift(incoming);
    if (payload.papers.length > 5) {
      const dropped = payload.papers.pop();
      console.log(`5件超過のため末尾を削除: ${dropped?.id}`);
    }
    console.log(`先頭に追加: ${incoming.id}`);
  }

  payload.date = date;
  await writeJsonFileAtomic(filePath, payload);
  console.log(`Saved ${payload.papers.length} papers to ${filePath}`);
  console.log("次: npm run summarize:v2 -- " + date);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
