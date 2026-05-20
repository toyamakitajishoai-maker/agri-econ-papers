import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { Paper } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

type DailyData = {
  date: string;
  papers: Paper[];
};

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getJstDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function getAvailableDates(): Promise<string[]> {
  const indexPath = path.join(DATA_DIR, "index.json");
  const indexJson = await readJsonFile<{ dates?: string[] }>(indexPath);
  return Array.isArray(indexJson?.dates) ? indexJson.dates : [];
}

/** `data/YYYY-MM-DD.json` の日付一覧（新しい順） */
async function listStoredDatesDescending(): Promise<string[]> {
  try {
    const entries = await readdir(DATA_DIR);
    return entries
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.replace(/\.json$/, ""))
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

export async function getDailyPapers(date: string): Promise<Paper[]> {
  const filePath = path.join(DATA_DIR, `${date}.json`);
  const daily = await readJsonFile<DailyData>(filePath);
  return Array.isArray(daily?.papers) ? daily.papers : [];
}

export async function getTodayPapers(): Promise<{
  date: string;
  papers: Paper[];
  /** 今日のファイルではなく、過去日のデータを表示しているとき true */
  isPastDateDisplay: boolean;
}> {
  const today = getJstDateString();
  const todayPapers = await getDailyPapers(today);
  if (todayPapers.length > 0) {
    return { date: today, papers: todayPapers, isPastDateDisplay: false };
  }

  const indexDates = await getAvailableDates();
  const diskDates = await listStoredDatesDescending();
  const candidateDates = [...new Set([today, ...indexDates, ...diskDates])].sort((a, b) =>
    b.localeCompare(a)
  );

  for (const date of candidateDates) {
    const papers = await getDailyPapers(date);
    if (papers.length > 0) {
      return {
        date,
        papers,
        isPastDateDisplay: date !== today,
      };
    }
  }

  return { date: today, papers: [], isPastDateDisplay: false };
}

export async function getPaperById(id: string): Promise<Paper | null> {
  const dates = await getAvailableDates();
  const normalizedId = decodeURIComponent(id);

  for (const date of dates) {
    const papers = await getDailyPapers(date);
    const found = papers.find((paper) => paper.id === normalizedId);
    if (found) {
      return found;
    }
  }

  return null;
}
