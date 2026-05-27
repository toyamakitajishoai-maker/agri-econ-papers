import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { downloadPdfFromUrl, isWeakPdfUrl, resolvePdfUrl } from "@/lib/pdfResolve";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper } from "@/lib/types";

const DATA_DIR = "data";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const date = process.argv[2];
  if (!date) {
    throw new Error("使い方: npm run backfill:pdf -- YYYY-MM-DD");
  }

  const filePath = `${DATA_DIR}/${date}.json`;
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { date: string; papers: Paper[] };
  const papers = parsed.papers ?? [];
  let updated = 0;
  let downloadable = 0;

  for (const paper of papers) {
    const weak = !paper.pdfUrl?.trim() || isWeakPdfUrl(paper.pdfUrl);
    if (!weak && paper.pdfUrl) {
      const ok = await downloadPdfFromUrl(paper.pdfUrl);
      if (ok) {
        downloadable += 1;
        continue;
      }
    }

    const resolved = await resolvePdfUrl({
      doi: paper.doi,
      pdfUrl: paper.pdfUrl,
      id: paper.id,
      source: paper.source,
    });

    if (resolved && resolved !== paper.pdfUrl) {
      paper.pdfUrl = resolved;
      updated += 1;
    }

    const testUrl = resolved ?? paper.pdfUrl;
    if (testUrl) {
      const ok = await downloadPdfFromUrl(testUrl);
      if (ok) downloadable += 1;
    }

    await sleep(Number(process.env.UNPAYWALL_GAP_MS ?? 280));
  }

  await writeJsonFileAtomic(filePath, { date: parsed.date ?? date, papers });
  console.log(
    `Done: ${filePath} — URL更新 ${updated}件 / PDF取得可能 ${downloadable}/${papers.length}件`
  );
}

main().catch((error) => {
  console.error("backfill-pdf-urls failed:", error);
  process.exit(1);
});
