import { config as loadEnv } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

import { buildAudioForPaper, isAudioFresh, isReadyForAudio } from "@/lib/buildAudio";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper } from "@/lib/types";

const DATA_DIR = "data";

type DateFile = { date: string; papers: Paper[] };

async function listDataFiles(): Promise<string[]> {
  const entries = await readdir(DATA_DIR);
  return entries
    .filter((f) => f.endsWith(".json") && /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");

  const force = process.env.FORCE_AUDIO === "1" || process.env.FORCE_AUDIO === "true";
  const onlyId = process.env.ONLY_ID?.trim() || null;
  const gapMs = Number(process.env.TTS_GAP_MS ?? 2000);

  const files = await listDataFiles();
  console.log(`対象データファイル: ${files.length} 件`);

  let total = 0;
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let bytesTotal = 0;

  for (const fname of files) {
    const filePath = path.join(DATA_DIR, fname);
    const raw = await readFile(filePath, "utf-8");
    if (!raw.trim()) continue;
    let parsed: DateFile;
    try {
      parsed = JSON.parse(raw) as DateFile;
    } catch {
      console.warn(`  ${fname} 壊れています。スキップ`);
      continue;
    }
    const papers = parsed.papers ?? [];
    let changed = false;

    for (let i = 0; i < papers.length; i += 1) {
      const paper = papers[i];
      total += 1;
      if (onlyId && paper.id !== onlyId) continue;
      if (!isReadyForAudio(paper)) {
        skipped += 1;
        continue;
      }
      if (!force && isAudioFresh(paper.audio)) {
        skipped += 1;
        continue;
      }

      const label = paper.catchTitle ?? paper.titleJa ?? paper.title;
      const shortLabel = label.length > 44 ? `${label.slice(0, 44)}…` : label;
      console.log(`[${fname}] 生成中: ${shortLabel}`);
      const started = Date.now();
      try {
        const { audio, bytes } = await buildAudioForPaper(paper, apiKey);
        papers[i] = { ...paper, audio };
        changed = true;
        generated += 1;
        bytesTotal += bytes;
        const elapsed = ((Date.now() - started) / 1000).toFixed(1);
        console.log(
          `  ✓ ${audio.duration ?? "?"}秒 / ${(bytes / 1024).toFixed(0)} KB (${elapsed}s)`
        );
      } catch (e) {
        failed += 1;
        console.error(`  ✗ 失敗: ${e instanceof Error ? e.message : String(e)}`);
      }

      if (changed) {
        await writeJsonFileAtomic(filePath, { date: parsed.date ?? fname.replace(".json", ""), papers });
      }
      await sleep(gapMs);
    }
  }

  console.log("---");
  console.log(
    `Done: ${generated} generated, ${skipped} skipped, ${failed} failed, ${total} total ` +
      `(${(bytesTotal / 1024 / 1024).toFixed(1)} MB)`
  );
  if (skipped > 0 && !force) console.log("再生成するときは FORCE_AUDIO=1 を付けてください。");
}

main().catch((e) => {
  console.error("backfill-audio failed:", e);
  process.exit(1);
});
