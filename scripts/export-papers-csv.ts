import { config as loadEnv } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

import { rowToCsvLine } from "@/lib/csvExport";
import {
  fetchOpenAlexSourceJournalMetrics,
  fetchOpenAlexWorkMetrics,
} from "@/lib/openAlexMetrics";
import type { Paper } from "@/lib/types";

loadEnv({ path: ".env.local" });
loadEnv();

const DATA_DIR = "data";
const EXPORT_DIR = "exports";
const ACCUMULATED = path.join(EXPORT_DIR, "papers-accumulated.csv");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const HEADERS = [
  "チェック",
  "DOI",
  "タイトル",
  "著者",
  "出版ジャーナル",
  "ジャーナル2年平均被引用",
  "ジャーナルh指数",
  "出版日",
  "引用数",
  "出版年",
  "内部ID",
  "一覧URL",
] as const;

type CsvRow = Record<(typeof HEADERS)[number], string>;

function getJstDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function publicationDateOnly(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function yearFromPublished(iso: string): string {
  if (!iso) return "";
  const y = iso.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : "";
}

function rowKey(row: CsvRow): string {
  const doi = row.DOI.trim();
  if (doi) return `doi:${doi.toLowerCase()}`;
  return `id:${row["内部ID"].trim()}`;
}

function formatTwoYrMean(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, "");
}

function paperToRow(
  paper: Paper,
  metrics: { cited: string; year: string; journal: string; twoYrMean: string; journalH: string }
): CsvRow {
  const doi = (paper.doi ?? "").trim();
  const pub = publicationDateOnly(paper.publishedAt);
  const yearFromPaper = yearFromPublished(paper.publishedAt);
  const year = metrics.year || yearFromPaper;
  return {
    チェック: "",
    DOI: doi,
    タイトル: paper.titleJa?.trim() || paper.title,
    著者: paper.authors.join("；"),
    出版ジャーナル: metrics.journal,
    ジャーナル2年平均被引用: metrics.twoYrMean,
    ジャーナルh指数: metrics.journalH,
    出版日: pub,
    引用数: metrics.cited,
    出版年: year,
    内部ID: paper.id,
    一覧URL: paper.url,
  };
}

function objectToRow(o: CsvRow): string[] {
  return HEADERS.map((h) => o[h] ?? "");
}

async function readAccumulated(): Promise<CsvRow[]> {
  try {
    const raw = await readFile(ACCUMULATED, "utf-8");
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    return records.map((r) => {
      const row = {} as CsvRow;
      for (const h of HEADERS) {
        row[h] = String(r[h] ?? "");
      }
      return row;
    });
  } catch {
    return [];
  }
}

async function main() {
  const argDate = process.argv[2];
  const date = argDate && /^\d{4}-\d{2}-\d{2}$/.test(argDate) ? argDate : getJstDateString();
  const filePath = path.join(DATA_DIR, `${date}.json`);

  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { papers?: Paper[] };
  const papers = parsed.papers ?? [];

  const mailto = (process.env.OPENALEX_MAILTO ?? process.env.UNPAYWALL_EMAIL ?? "").trim();
  if (!mailto) {
    console.warn("OPENALEX_MAILTO または UNPAYWALL_EMAIL があると引用数の取得精度が上がります（OpenAlex 利用マナー）。");
  }

  const existing = await readAccumulated();
  const byKey = new Map<string, CsvRow>();
  for (const row of existing) {
    byKey.set(rowKey(row), row);
  }

  const sourceStatsCache = new Map<string, { twoYearMeanCitedness: number | null; hIndex: number | null }>();

  for (const paper of papers) {
    let cited = "";
    let year = "";
    let journal = "";
    let twoYrMean = "";
    let journalH = "";
    if (mailto) {
      await sleep(300);
      const workMetrics = await fetchOpenAlexWorkMetrics({
        doi: paper.doi,
        openAlexWorkId: /^W\d+$/i.test(paper.id) ? paper.id : undefined,
        mailto,
      });
      if (workMetrics.citedByCount != null) cited = String(workMetrics.citedByCount);
      if (workMetrics.publicationYear != null) year = String(workMetrics.publicationYear);
      if (workMetrics.journalName) journal = workMetrics.journalName;

      if (workMetrics.sourceShortId) {
        let src = sourceStatsCache.get(workMetrics.sourceShortId);
        if (!src) {
          await sleep(300);
          src = await fetchOpenAlexSourceJournalMetrics({
            sourceShortId: workMetrics.sourceShortId,
            mailto,
          });
          sourceStatsCache.set(workMetrics.sourceShortId, src);
        }
        if (src.twoYearMeanCitedness != null) twoYrMean = formatTwoYrMean(src.twoYearMeanCitedness);
        if (src.hIndex != null) journalH = String(src.hIndex);
      }
    }

    const fresh = paperToRow(paper, { cited, year, journal, twoYrMean, journalH });
    const key = rowKey(fresh);
    const prev = byKey.get(key);
    if (prev) {
      fresh.チェック = prev.チェック;
      fresh.DOI = fresh.DOI || prev.DOI;
      fresh.タイトル = fresh.タイトル || prev.タイトル;
      fresh.出版ジャーナル = fresh.出版ジャーナル || prev.出版ジャーナル;
      fresh.ジャーナル2年平均被引用 = fresh.ジャーナル2年平均被引用 || prev.ジャーナル2年平均被引用;
      fresh.ジャーナルh指数 = fresh.ジャーナルh指数 || prev.ジャーナルh指数;
    }
    byKey.set(key, fresh);
  }

  const merged = [...byKey.values()].sort((a, b) => {
    const da = a.出版日 || "0000-00-00";
    const db = b.出版日 || "0000-00-00";
    return db.localeCompare(da);
  });

  await mkdir(EXPORT_DIR, { recursive: true });

  const lines = [rowToCsvLine([...HEADERS]), ...merged.map((r) => rowToCsvLine(objectToRow(r)))];
  const csv = lines.join("\n") + "\n";
  await writeFile(ACCUMULATED, csv, "utf-8");

  const snapshot = path.join(EXPORT_DIR, `papers-export-${date}.csv`);
  await writeFile(snapshot, csv, "utf-8");

  console.log(`Wrote ${merged.length} rows -> ${ACCUMULATED}`);
  console.log(`Snapshot -> ${snapshot}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
