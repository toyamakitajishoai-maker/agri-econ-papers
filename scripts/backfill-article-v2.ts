/**
 * 既存の日次 JSON に v2 フィールドを付与（Gemini 再要約）。
 * 使い方:
 *   npm run backfill:article-v2 -- 2026-05-28   … 1日分
 *   npm run backfill:article-v2 -- all         … data/ 内の全日付
 *   npm run backfill:article-v2                … きょう JST
 */
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

async function listDailyDates(): Promise<string[]> {
  const files = await readdir(DATA_DIR);
  return files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort((a, b) => b.localeCompare(a));
}

function runSummarizeForDate(date: string): Promise<number> {
  return new Promise((resolve) => {
    const args = ["run", "summarize:v2", "--", date];
    const child = spawn("npm", args, {
      stdio: "inherit",
      env: {
        ...process.env,
        SUMMARIZE_ARTICLE_V2: "1",
        FORCE_SUMMARIZE: process.env.FORCE_SUMMARIZE ?? "1",
      },
      shell: true,
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const arg = process.argv[2] ?? "";
  const dates =
    arg === "all" ? await listDailyDates() : arg ? [arg] : [""];

  if (dates.length === 0) {
    console.error("data/ に日次 JSON がありません。");
    process.exit(1);
  }

  let failed = 0;
  for (const date of dates) {
    if (date) console.log(`\n======== ${date} ========`);
    const code = await runSummarizeForDate(date || getTodayJst());
    if (code !== 0) failed += 1;
  }

  if (failed > 0) {
    console.error(`\n${failed} 日分でエラーがありました。`);
    process.exit(1);
  }
  console.log(dates.length > 1 ? "\n全日付の v2 バックフィルが完了しました。" : "");
}

function getTodayJst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
