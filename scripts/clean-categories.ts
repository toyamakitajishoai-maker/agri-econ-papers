/**
 * 既存データの categories から、fetchTopics の labelJa（日本語の分野名）を取り除く。
 * 過去データが categoryMap.ts の安全装置で隠れていても、根本データを綺麗にしておく。
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { FETCH_TOPICS } from "@/lib/fetchTopics";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper } from "@/lib/types";

const DATA_DIR = "data";
const TOPIC_LABELS = new Set(FETCH_TOPICS.map((t) => t.labelJa));

async function main() {
  const entries = await readdir(DATA_DIR);
  const files = entries
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  let touchedFiles = 0;
  let touchedPapers = 0;
  let removedTags = 0;

  for (const fname of files) {
    const filePath = path.join(DATA_DIR, fname);
    const raw = await readFile(filePath, "utf-8");
    if (!raw.trim()) continue;
    let parsed: { date: string; papers: Paper[] };
    try {
      parsed = JSON.parse(raw) as { date: string; papers: Paper[] };
    } catch {
      console.warn(`  ${fname} 壊れています。スキップ`);
      continue;
    }
    let fileChanged = false;
    for (const paper of parsed.papers ?? []) {
      const before = paper.categories ?? [];
      const after = before.filter((c) => !TOPIC_LABELS.has(c.trim()));
      if (after.length !== before.length) {
        removedTags += before.length - after.length;
        paper.categories = after;
        touchedPapers += 1;
        fileChanged = true;
      }
    }
    if (fileChanged) {
      await writeJsonFileAtomic(filePath, parsed);
      touchedFiles += 1;
      console.log(`  cleaned: ${fname}`);
    }
  }
  console.log("---");
  console.log(
    `Done: ${touchedFiles} files, ${touchedPapers} papers, ${removedTags} tags removed`
  );
}

main().catch((e) => {
  console.error("clean-categories failed:", e);
  process.exit(1);
});
