/**
 * 全論文を Gemini Embedding で意味ベクトル化し、各論文に対する
 * 類似上位 3 件を data/related.json に書き出す。
 *
 * 多様性のため、上位 6 件を取得 → 同一 field をなるべく避けて 3 件選ぶ。
 */
import { config as loadEnv } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

import { cosineSimilarity, embedText, normalize } from "@/lib/embedding";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { Paper } from "@/lib/types";

const DATA_DIR = "data";
const OUTPUT = path.join(DATA_DIR, "related.json");
const TOP_K = 3;
const POOL = 8;
const EMBED_GAP_MS = Number(process.env.EMBED_GAP_MS ?? 600);

type DateFile = { date: string; papers: Paper[] };

type Indexed = {
  id: string;
  field?: string;
  date: string;
  catchTitle: string;
  vector: number[];
};

type RelatedItem = { id: string; score: number };
type RelatedMap = Record<string, RelatedItem[]>;

function buildEmbedText(p: Paper): string {
  const parts: string[] = [];
  if (p.catchTitle?.trim()) parts.push(p.catchTitle.trim());
  if (p.hook?.trim()) parts.push(p.hook.trim());
  if (p.takeaway) {
    parts.push(p.takeaway.whatIsIt, p.takeaway.whatFound, p.takeaway.soWhat);
  }
  // 検索品質のため要約本文の最初も少し混ぜる
  if (p.summary?.gist) parts.push(p.summary.gist);
  if (p.summary?.results) parts.push(p.summary.results.slice(0, 200));
  return parts.filter(Boolean).join("\n\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function listAllPapers(): Promise<Array<{ paper: Paper; date: string }>> {
  const entries = await readdir(DATA_DIR);
  const files = entries
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  const all: Array<{ paper: Paper; date: string }> = [];
  for (const fname of files) {
    const raw = await readFile(path.join(DATA_DIR, fname), "utf-8");
    if (!raw.trim()) continue;
    try {
      const parsed = JSON.parse(raw) as DateFile;
      const date = (parsed.date ?? fname.replace(".json", "")) as string;
      for (const p of parsed.papers ?? []) {
        all.push({ paper: p, date });
      }
    } catch {
      console.warn(`  ${fname} 壊れています。スキップ`);
    }
  }
  return all;
}

/**
 * 多様性ブースト：上位 POOL 件から、同じ field が連続しないように top K 件を選ぶ。
 * 上位の高スコア順は維持しつつ、同フィールド連続を最大 1 件に抑える。
 */
function pickDiversified(
  pool: Array<{ id: string; score: number; field?: string }>,
  current: Indexed,
  k: number
): RelatedItem[] {
  const sorted = [...pool].sort((a, b) => b.score - a.score);
  const result: typeof pool = [];
  const fieldCount: Record<string, number> = {};
  for (const c of sorted) {
    const f = c.field ?? "_";
    // 自分と同じ field は最大 1 件まで、それ以外も最大 2 件まで
    const limit = f === current.field ? 1 : 2;
    if ((fieldCount[f] ?? 0) >= limit) continue;
    result.push(c);
    fieldCount[f] = (fieldCount[f] ?? 0) + 1;
    if (result.length >= k) break;
  }
  // 制限で埋まらなければスコア順で穴埋め
  if (result.length < k) {
    for (const c of sorted) {
      if (result.find((r) => r.id === c.id)) continue;
      result.push(c);
      if (result.length >= k) break;
    }
  }
  return result.map(({ id, score }) => ({ id, score: Number(score.toFixed(4)) }));
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");

  const all = await listAllPapers();
  console.log(`全論文: ${all.length}件`);

  const indexed: Indexed[] = [];
  let i = 0;
  for (const { paper, date } of all) {
    i += 1;
    const text = buildEmbedText(paper);
    if (!text.trim()) {
      console.log(`  [${i}/${all.length}] スキップ（テキスト無し）: ${paper.id}`);
      continue;
    }
    try {
      const raw = await embedText(text, { apiKey });
      const vec = normalize(raw);
      indexed.push({
        id: paper.id,
        field: paper.field,
        date,
        catchTitle: paper.catchTitle ?? paper.titleJa ?? paper.title,
        vector: vec,
      });
      const shortTitle =
        (paper.catchTitle ?? paper.titleJa ?? paper.title).slice(0, 38);
      console.log(`  [${i}/${all.length}] ✓ ${shortTitle}`);
    } catch (e) {
      console.error(
        `  [${i}/${all.length}] ✗ ${paper.id}: ${e instanceof Error ? e.message : e}`
      );
    }
    await sleep(EMBED_GAP_MS);
  }

  console.log(`\n埋め込み完了: ${indexed.length}件\n類似度計算中...`);

  const map: RelatedMap = {};
  for (const current of indexed) {
    const pool: Array<{ id: string; score: number; field?: string }> = [];
    for (const other of indexed) {
      if (other.id === current.id) continue;
      const score = cosineSimilarity(current.vector, other.vector);
      pool.push({ id: other.id, score, field: other.field });
    }
    pool.sort((a, b) => b.score - a.score);
    const top = pool.slice(0, POOL);
    map[current.id] = pickDiversified(top, current, TOP_K);
  }

  await writeJsonFileAtomic(OUTPUT, {
    generatedAt: new Date().toISOString(),
    model: process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001",
    dimension: Number(process.env.GEMINI_EMBED_DIM ?? 768),
    related: map,
  });
  console.log(`\nDone: ${OUTPUT} (${Object.keys(map).length}論文)`);
}

main().catch((e) => {
  console.error("build-related failed:", e);
  process.exit(1);
});
