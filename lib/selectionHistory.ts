import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { resolvePaperSlot } from "@/lib/classifyPaper";
import type { CategoryL1, Paper } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

type DailyFile = { date?: string; papers?: Paper[] };

async function listRecentDateFiles(days: number, beforeDate?: string): Promise<string[]> {
  let files: string[] = [];
  try {
    files = await readdir(DATA_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .filter((d) => !beforeDate || d < beforeDate)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, days);
}

/** 直近 N 日分の category_l1 選出回数 */
export async function loadRecentCategoryLoad(
  days = 7,
  beforeDate?: string
): Promise<Partial<Record<CategoryL1, number>>> {
  const counts: Partial<Record<CategoryL1, number>> = {};
  for (const date of await listRecentDateFiles(days, beforeDate)) {
    try {
      const raw = await readFile(path.join(DATA_DIR, `${date}.json`), "utf-8");
      const parsed = JSON.parse(raw) as DailyFile;
      for (const p of parsed.papers ?? []) {
        const l1 = resolvePaperSlot(p).categoryL1;
        counts[l1] = (counts[l1] ?? 0) + 1;
      }
    } catch {
      /* skip */
    }
  }
  return counts;
}

/** 直近 N 日分の category_l2 選出回数（1日最大1本制約用） */
export async function loadRecentCategoryL2Load(
  days = 7,
  beforeDate?: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const date of await listRecentDateFiles(days, beforeDate)) {
    try {
      const raw = await readFile(path.join(DATA_DIR, `${date}.json`), "utf-8");
      const parsed = JSON.parse(raw) as DailyFile;
      for (const p of parsed.papers ?? []) {
        const l2 = resolvePaperSlot(p).categoryL2;
        if (l2) counts[l2] = (counts[l2] ?? 0) + 1;
      }
    } catch {
      /* skip */
    }
  }
  return counts;
}
