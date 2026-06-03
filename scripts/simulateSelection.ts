/**
 * 日次選出のドライラン（Phase 3-5）
 * - 直近30日分の data を候補プールに、クォータ選出を繰り返す
 * - category_l1 / category_l2 分布と制約違反を表示
 */
import { config as loadEnv } from "dotenv";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

import type { ArxivPaper } from "@/lib/arxiv";
import { classifyPaper } from "@/lib/classifyPaper";
import {
  DAILY_QUOTA,
  histogramCategoryL1,
  histogramCategoryL2,
  selectWithQuotaMMR,
  validateDailyQuota,
} from "@/lib/selectDailyPapers";
import type { Paper } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SIM_DAYS = Number(process.env.SIM_DAYS ?? 30);
const POOL = Number(process.env.SIM_POOL ?? 120);

type DailyFile = { date?: string; papers?: Paper[] };

function paperToCandidate(p: Paper): ArxivPaper {
  return {
    id: p.id,
    title: p.title,
    authors: p.authors,
    publishedAt: p.publishedAt,
    url: p.url,
    pdfUrl: p.pdfUrl,
    categories: p.categories,
    abstract: p.abstract,
    doi: p.doi,
    source: p.source,
    journal: p.journal,
    field: p.field,
  };
}

async function loadPoolFromDates(maxDates: number): Promise<{ pool: ArxivPaper[]; dates: string[] }> {
  const files = await readdir(DATA_DIR);
  const dates = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, maxDates);

  const byId = new Map<string, ArxivPaper>();
  for (const date of dates) {
    const raw = await readFile(path.join(DATA_DIR, `${date}.json`), "utf-8");
    const parsed = JSON.parse(raw) as DailyFile;
    for (const p of parsed.papers ?? []) {
      if (!byId.has(p.id)) byId.set(p.id, paperToCandidate(p));
    }
  }
  return { pool: [...byId.values()], dates };
}

function printBar(label: string, count: number, total: number) {
  const width = 24;
  const filled = total > 0 ? Math.round((count / total) * width) : 0;
  console.log(`${label.padEnd(22)} ${"█".repeat(filled)}${"░".repeat(width - filled)} ${count}`);
}

async function main() {
  const { pool: allCandidates, dates } = await loadPoolFromDates(SIM_DAYS);
  if (allCandidates.length < 5) {
    console.error(`候補が ${allCandidates.length} 件しかありません`);
    process.exit(1);
  }

  console.log("=== Phase 3 選出シミュレーション（乾走） ===\n");
  console.log(`候補プール: ${allCandidates.length} 件（直近 ${dates.length} 日分の data）`);
  console.log(`シミュレーション日数: ${dates.length} 日`);
  console.log(`1日のクォータ: 農経 ${DAILY_QUOTA["agri-econ"]} / 隣接 ${DAILY_QUOTA.adjacent} / セレン ${DAILY_QUOTA.serendipity}\n`);

  const aggL1 = { "agri-econ": 0, adjacent: 0, serendipity: 0 };
  const aggL2: Record<string, number> = {};
  let violationDays = 0;
  const violationSamples: string[] = [];

  for (const simDate of dates) {
    const shuffled = [...allCandidates].sort(() => Math.random() - 0.5).slice(0, POOL);
    const result = await selectWithQuotaMMR(shuffled, {
      maxPapers: POOL,
      todayDate: simDate,
      now: new Date(`${simDate}T12:00:00+09:00`),
    });

    const picks = result.quotaPicks.map((q) => q.paper);
    const h1 = histogramCategoryL1(picks);
    const h2 = histogramCategoryL2(picks);
    const errors = validateDailyQuota(picks);

    for (const [k, v] of Object.entries(h1)) {
      aggL1[k as keyof typeof aggL1] += v;
    }
    for (const [k, v] of Object.entries(h2)) {
      aggL2[k] = (aggL2[k] ?? 0) + v;
    }

    if (errors.length > 0) {
      violationDays += 1;
      if (violationSamples.length < 5) {
        violationSamples.push(`${simDate}: ${errors.join("; ")}`);
      }
    }
  }

  const totalPicks = dates.length * 5;
  console.log("--- category_l1 合計（全シミュレーション日） ---");
  printBar("agri-econ", aggL1["agri-econ"], totalPicks);
  printBar("adjacent", aggL1.adjacent, totalPicks);
  printBar("serendipity", aggL1.serendipity, totalPicks);
  console.log(`\n期待比率: agri ${((DAILY_QUOTA["agri-econ"] / 5) * 100).toFixed(0)}% / adj ${((DAILY_QUOTA.adjacent / 5) * 100).toFixed(0)}% / seren ${((DAILY_QUOTA.serendipity / 5) * 100).toFixed(0)}%`);

  console.log("\n--- category_l2 上位 ---");
  const l2Sorted = Object.entries(aggL2).sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [k, v] of l2Sorted) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\n--- 制約チェック ---");
  if (violationDays === 0) {
    console.log("  すべての日で 農経2 + 隣接2 + セレン1 を満たしました。");
  } else {
    console.log(`  制約違反があった日: ${violationDays} / ${dates.length}`);
    for (const s of violationSamples) {
      console.log(`    · ${s}`);
    }
  }

  console.log("\n（実際の fetch では PDF 検証で件数が変動する場合があります）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
