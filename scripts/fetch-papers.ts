import { config as loadEnv } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { fetchArxivPapersSince } from "@/lib/arxiv";
import type { ArxivPaper } from "@/lib/arxiv";
import { dedupeByArxivId, filterAgriculturePapers } from "@/lib/filter";
import { fetchOpenAlexRecentWorks } from "@/lib/openAlex";
import { fetchSemanticScholarArxivPapers } from "@/lib/semanticScholar";
import type { Paper } from "@/lib/types";
import { lookupOpenAccessPdfUrl } from "@/lib/unpaywall";

const TARGET_CATEGORIES = ["econ.GN", "econ.EM", "q-fin.EC"];
const DATA_DIR = "data";

/** arXiv 補完用（1回のAPIで取得し、窓はメモリ上で絞る） */
const ARXIV_FETCH_HOURS = 720;
const ARXIV_LOOKBACK_HOURS = [24, 72, 168, 336, 720];

const OPENALEX_LOOKBACK_DAYS = 90;
const OPENALEX_SEARCH = "agricultural economics food security rural farm land policy";

const SEMANTIC_DELAY_MS = 2000;
const UNPAYWALL_GAP_MS = 280;

const MAX_PAPERS = 15;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTodayJstString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** JST 基準で N 日前の日付 YYYY-MM-DD */
function getJstDateMinusDays(days: number): string {
  const ms = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function emptySummary(abstract: string, mode: "pending" | "fallback" = "pending") {
  const placeholder =
    mode === "fallback" ? "同分野の新着（農業キーワード未一致）" : "要約準備中";
  return {
    gist: placeholder,
    novelty: abstract,
    method: abstract,
    results: abstract,
  };
}

function toPaperSchema(input: ArxivPaper, summaryMode: "pending" | "fallback" = "pending"): Paper {
  const source = input.source ?? "arxiv";
  return {
    id: input.id,
    title: input.title,
    authors: input.authors,
    publishedAt: input.publishedAt,
    url: input.url,
    pdfUrl: input.pdfUrl,
    categories: input.categories,
    abstract: input.abstract,
    summary: emptySummary(input.abstract, summaryMode),
    doi: input.doi,
    source,
    journal: input.journal,
  };
}

async function updateIndex(dateString: string) {
  const indexPath = `${DATA_DIR}/index.json`;
  let dates: string[] = [];

  try {
    const raw = await readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw) as { dates?: string[] };
    dates = Array.isArray(parsed.dates) ? parsed.dates : [];
  } catch {
    dates = [];
  }

  const nextDates = [dateString, ...dates.filter((d) => d !== dateString)].slice(0, 30);

  await writeFile(indexPath, JSON.stringify({ dates: nextDates }, null, 2), "utf-8");
}

async function fetchArxivPool(now: Date): Promise<ArxivPaper[]> {
  const widestSince = new Date(now.getTime() - ARXIV_FETCH_HOURS * 60 * 60 * 1000);
  try {
    return await fetchArxivPapersSince(TARGET_CATEGORIES, widestSince, 100, now);
  } catch (error) {
    console.warn("arXiv の取得に失敗しました（スキップします）。", error);
    return [];
  }
}

function pickArxivWindowed(
  arxivRawFull: ArxivPaper[],
  now: Date
): { filtered: ArxivPaper[]; usedKeywordFallback: boolean } {
  let arxivFiltered: ArxivPaper[] = [];
  const lastArxivRaw = arxivRawFull;
  let usedKeywordFallback = false;

  for (const hours of ARXIV_LOOKBACK_HOURS) {
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const inWindow = arxivRawFull.filter((paper) => {
      if (!paper.publishedAt) return false;
      return new Date(paper.publishedAt) >= since;
    });
    arxivFiltered = dedupeByArxivId(filterAgriculturePapers(inWindow));
    if (arxivFiltered.length > 0) {
      break;
    }
  }

  if (arxivFiltered.length === 0 && lastArxivRaw.length > 0) {
    console.warn(
      "arXiv: 農業キーワード未一致のため、対象カテゴリの新着をフォールバックで採用します。"
    );
    arxivFiltered = dedupeByArxivId(lastArxivRaw)
      .slice(0, MAX_PAPERS)
      .map((p) => ({ ...p, source: "arxiv" as const }));
    usedKeywordFallback = true;
  }

  return {
    filtered: arxivFiltered.map((p) => ({ ...p, source: p.source ?? ("arxiv" as const) })),
    usedKeywordFallback,
  };
}

async function enrichPdfFromUnpaywall(papers: ArxivPaper[], email: string): Promise<void> {
  for (const paper of papers) {
    if (!paper.doi) continue;
    try {
      const pdfUrl = await lookupOpenAccessPdfUrl(paper.doi, email);
      if (pdfUrl) {
        paper.pdfUrl = pdfUrl;
      }
    } catch (error) {
      console.warn(`Unpaywall skip (${paper.doi}):`, error);
    }
    await sleep(UNPAYWALL_GAP_MS);
  }
}

async function main() {
  const today = getTodayJstString();
  await mkdir(DATA_DIR, { recursive: true });

  const mailto = (process.env.OPENALEX_MAILTO ?? process.env.UNPAYWALL_EMAIL ?? "").trim();
  const unpaywallEmail = (process.env.UNPAYWALL_EMAIL ?? process.env.OPENALEX_MAILTO ?? "").trim();

  const now = new Date();
  const merged: ArxivPaper[] = [];

  /* ----- 主ソース: OpenAlex（メールアドレス必須: API利用マナー） ----- */
  if (mailto) {
    try {
      const fromPublicationDate = getJstDateMinusDays(OPENALEX_LOOKBACK_DAYS);
      const openAlexRaw = await fetchOpenAlexRecentWorks({
        mailto,
        fromPublicationDate,
        searchQuery: OPENALEX_SEARCH,
        perPage: 50,
      });

      let oaFiltered = dedupeByArxivId(filterAgriculturePapers(openAlexRaw));
      if (oaFiltered.length === 0 && openAlexRaw.length > 0) {
        console.warn("OpenAlex: 農業キーワード未一致のため、検索上位をフォールバックで採用します。");
        oaFiltered = dedupeByArxivId(openAlexRaw).slice(0, MAX_PAPERS);
      }

      const oaPick = oaFiltered.slice(0, MAX_PAPERS);
      if (unpaywallEmail) {
        await enrichPdfFromUnpaywall(oaPick, unpaywallEmail);
      } else {
        console.warn("UNPAYWALL_EMAIL（または OPENALEX_MAILTO）がないため、OA PDF の自動解決をスキップします。");
      }
      merged.push(...oaPick);
    } catch (error) {
      console.warn("OpenAlex の取得に失敗しました（arXiv 等で補完します）。", error);
    }
  } else {
    console.warn(
      "OPENALEX_MAILTO または UNPAYWALL_EMAIL を .env.local に設定すると、OpenAlex から論文を取得します（推奨）。"
    );
  }

  /* ----- 補完: arXiv ----- */
  const needArxiv = Math.max(0, MAX_PAPERS - merged.length);
  if (needArxiv > 0) {
    const arxivRawFull = await fetchArxivPool(now);
    const { filtered } = pickArxivWindowed(arxivRawFull, now);
    merged.push(...filtered.slice(0, needArxiv));
  }

  /* ----- 補完: Semantic Scholar（arXiv ID 付きのみ） ----- */
  const needSemantic = Math.max(0, MAX_PAPERS - merged.length);
  if (needSemantic > 0) {
    try {
      await sleep(SEMANTIC_DELAY_MS);
      const semanticRaw = await fetchSemanticScholarArxivPapers("agricultural economics", 20);
      const semanticFiltered = dedupeByArxivId(
        filterAgriculturePapers(semanticRaw.map((p) => ({ ...p, source: "arxiv" as const })))
      );
      merged.push(...semanticFiltered.slice(0, needSemantic));
    } catch (error) {
      console.warn("Semantic Scholar fetch skipped:", error);
    }
  }

  const finalList = dedupeByArxivId(merged).slice(0, MAX_PAPERS);
  const papers = finalList.map((p) =>
    toPaperSchema(p, filterAgriculturePapers([p]).length === 0 ? "fallback" : "pending")
  );

  const outputPath = `${DATA_DIR}/${today}.json`;
  await writeFile(outputPath, JSON.stringify({ date: today, papers }, null, 2), "utf-8");
  await updateIndex(today);

  console.log(`Saved ${papers.length} papers to ${outputPath} (OpenAlex + arXiv + 補助ソース)`);
}

main().catch((error) => {
  console.error("fetch-papers failed:", error);
  process.exit(1);
});
