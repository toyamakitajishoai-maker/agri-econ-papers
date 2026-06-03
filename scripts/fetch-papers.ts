import { config as loadEnv } from "dotenv";
import { mkdir, readFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { fetchArxivPapersSince } from "@/lib/arxiv";
import { fetchArxivPapersFromRss } from "@/lib/arxivRss";
import type { ArxivPaper } from "@/lib/arxiv";
import { dedupeByArxivId } from "@/lib/filter";
import {
  inferTopicForPaper,
  mergeArxivCategories,
  mergeOpenAlexTopics,
  pickArxivTopicsForFetch,
  pickTopicsForDailyFetch,
  pickRandomTopics,
  shuffleInPlace,
  type FetchTopic,
} from "@/lib/fetchTopics";
import { fetchOpenAlexRecentWorks } from "@/lib/openAlex";
import { fetchSemanticScholarArxivPapers } from "@/lib/semanticScholar";
import { classifyPaper } from "@/lib/classifyPaper";
import { selectWithQuotaMMR } from "@/lib/selectDailyPapers";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import type { CategoryL1, Paper } from "@/lib/types";
import { resolvePdfUrl } from "@/lib/pdfResolve";
import { extractPdfTextExcerpt } from "@/lib/extractPdfText";

const DATA_DIR = "data";

const ARXIV_FETCH_HOURS = 720;
const ARXIV_LOOKBACK_HOURS = [24, 72, 168, 336, 720];

const OPENALEX_LOOKBACK_DAYS = 90;
const TOPICS_PER_FETCH = Number(process.env.TOPICS_PER_FETCH ?? 5);
const OPENALEX_PER_TOPIC = Number(process.env.OPENALEX_PER_TOPIC ?? 20);

const SEMANTIC_DELAY_MS = 2000;
const UNPAYWALL_GAP_MS = 280;
const OPENALEX_GAP_MS = 400;
const ARXIV_MAX_RESULTS = Number(process.env.ARXIV_MAX_RESULTS ?? 80);
const SEMANTIC_LIMIT = Number(process.env.SEMANTIC_LIMIT ?? 25);

const MAX_PAPERS = Number(process.env.MAX_PAPERS ?? 5);
const CANDIDATE_POOL_SIZE = Math.max(MAX_PAPERS * 10, 50);
const USE_SMART_SELECTION = process.env.USE_SMART_SELECTION !== "0";

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

function getJstDateMinusDays(days: number): string {
  const ms = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function emptySummary(abstract: string) {
  return {
    gist: "要約準備中",
    novelty: abstract,
    method: abstract,
    results: abstract,
  };
}

function toPaperSchema(input: ArxivPaper): Paper {
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
    summary: emptySummary(input.abstract),
    doi: input.doi,
    source,
    journal: input.journal,
    field: input.field,
    ...(() => {
      const c = classifyPaper({
        categories: input.categories,
        abstract: input.abstract,
        title: input.title,
        field: input.field,
      });
      return {
        categoryL1: c.categoryL1,
        categoryL2: c.categoryL2,
        arxivPrimary: c.arxivPrimary,
      };
    })(),
  };
}

async function loadInterestVector(): Promise<Partial<Record<CategoryL1, number>>> {
  const path = process.env.INTEREST_PROFILE_PATH ?? "data/interest-profile.json";
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as { vector?: Partial<Record<CategoryL1, number>> };
    return parsed.vector ?? (parsed as Partial<Record<CategoryL1, number>>);
  } catch {
    return {};
  }
}

function tagTopic(paper: ArxivPaper, topic: FetchTopic): ArxivPaper {
  /**
   * 注意: ここで categories に topic.labelJa を「日本語のまま」入れると、
   * editorial の getTags がそれをそのままタグとして拾い、
   * 例えば AI 論文に「開発経済」というタグが付く誤表示が起きる。
   * field には日本語ラベルを入れるが、categories には機械的な topic:xxx 接頭辞のみ残す。
   */
  return {
    ...paper,
    field: topic.labelJa,
    categories: [`topic:${topic.id}`, ...paper.categories],
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
  await writeJsonFileAtomic(indexPath, { dates: nextDates });
}

function pickArxivInTimeWindow(arxivRawFull: ArxivPaper[], now: Date): ArxivPaper[] {
  for (const hours of ARXIV_LOOKBACK_HOURS) {
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const inWindow = arxivRawFull.filter((paper) => {
      if (!paper.publishedAt) return false;
      return new Date(paper.publishedAt) >= since;
    });
    if (inWindow.length > 0) {
      return dedupeByArxivId(inWindow);
    }
  }
  return dedupeByArxivId(arxivRawFull);
}

/**
 * arXiv API は1日1回の fetch で **1リクエストのみ**（429対策）。
 * 複数分野のカテゴリを OR でまとめて取得する。
 */
async function fetchArxivForTopics(topics: FetchTopic[], now: Date): Promise<ArxivPaper[]> {
  if (topics.length === 0) return [];

  const categories = mergeArxivCategories(topics);
  const widestSince = new Date(now.getTime() - ARXIV_FETCH_HOURS * 60 * 60 * 1000);

  let raw: ArxivPaper[] = [];
  try {
    raw = await fetchArxivPapersSince(categories, widestSince, ARXIV_MAX_RESULTS, now, {
      softFail: true,
      maxAttempts: 4,
    });
  } catch (error) {
    console.warn("  arXiv API スキップ:", error);
  }

  if (raw.length === 0) {
    console.log("  arXiv API が使えないため RSS フィードから取得します…");
    raw = await fetchArxivPapersFromRss(topics, 25);
  }

  const windowed = pickArxivInTimeWindow(raw, now);
  const tagged = windowed.map((p) => tagTopic(p, inferTopicForPaper(p, topics)));
  console.log(
    `  arXiv 合計: ${raw.length}件 → 期間内 ${windowed.length}件 [${topics.map((t) => t.labelJa).join("、")}]`
  );
  return dedupeByArxivId(tagged);
}

function shortTitle(paper: ArxivPaper): string {
  const t = paper.title.trim();
  return t.length > 52 ? `${t.slice(0, 52)}…` : t;
}

/**
 * 出所が辿れない論文を弾く（著者不明・URLなし・DOIもID もないもの）
 */
function hasTraceableOrigin(paper: ArxivPaper): { ok: boolean; reason?: string } {
  const authorsClean = paper.authors
    .map((a) => a.trim())
    .filter((a) => a && a.toLowerCase() !== "unknown" && a !== "不明");
  if (authorsClean.length === 0) return { ok: false, reason: "著者不明" };
  if (!paper.url?.trim() && !paper.doi?.trim()) return { ok: false, reason: "出典URL/DOIなし" };
  if (!paper.title?.trim()) return { ok: false, reason: "タイトルなし" };
  return { ok: true };
}

async function selectPapersWithDownloadablePdf(
  candidates: ArxivPaper[],
  max: number
): Promise<ArxivPaper[]> {
  const selected: ArxivPaper[] = [];
  let dlFail = 0;
  let extractFail = 0;
  let tooShort = 0;
  let originFail = 0;

  for (const paper of candidates) {
    if (selected.length >= max) break;

    const origin = hasTraceableOrigin(paper);
    if (!origin.ok) {
      originFail += 1;
      console.log(`  [スキップ] ${origin.reason}: ${shortTitle(paper)}`);
      continue;
    }

    const resolved = await resolvePdfUrl({
      doi: paper.doi,
      pdfUrl: paper.pdfUrl,
      id: paper.id,
      source: paper.source,
    });
    if (resolved) paper.pdfUrl = resolved;

    /** ダウンロード + 本文抽出まで確認（本文がない論文を弾く） */
    const result = await extractPdfTextExcerpt({
      doi: paper.doi,
      pdfUrl: paper.pdfUrl,
      id: paper.id,
      source: paper.source,
    });

    if (result.excerpt && result.pdfUrl) {
      paper.pdfUrl = result.pdfUrl;
      selected.push(paper);
      const field = paper.field ?? "";
      console.log(
        `  [採用] ${field ? `[${field}] ` : ""}${shortTitle(paper)}（本文 ${result.chars ?? result.excerpt.length}字）`
      );
    } else {
      const reason =
        result.failureReason === "download-failed"
          ? "PDFダウンロード失敗"
          : result.failureReason === "too-short"
            ? `本文 ${result.chars ?? 0}字しか取れず`
            : "本文抽出に失敗";
      if (result.failureReason === "download-failed") dlFail += 1;
      else if (result.failureReason === "too-short") tooShort += 1;
      else extractFail += 1;
      const detail = result.detail ? ` — ${result.detail.slice(0, 80)}` : "";
      console.log(`  [スキップ] ${reason}${detail}: ${shortTitle(paper)}`);
    }

    await sleep(UNPAYWALL_GAP_MS);
  }

  console.log(
    `PDF検証: 採用 ${selected.length}件 / スキップ ${dlFail + extractFail + tooShort + originFail}件` +
      `（著者不明等 ${originFail} / ダウンロード失敗 ${dlFail} / 抽出失敗 ${extractFail} / 本文短すぎ ${tooShort}）`
  );
  return selected;
}

async function main() {
  const today = (process.env.FETCH_DATE ?? "").trim() || getTodayJstString();
  await mkdir(DATA_DIR, { recursive: true });

  const mailto = (process.env.OPENALEX_MAILTO ?? process.env.UNPAYWALL_EMAIL ?? "").trim();
  const unpaywallEmail = (process.env.UNPAYWALL_EMAIL ?? process.env.OPENALEX_MAILTO ?? "").trim();
  const now = new Date();
  const topics = pickTopicsForDailyFetch(TOPICS_PER_FETCH, {
    smartSelection: USE_SMART_SELECTION,
  });

  console.log(
    `収集日 ${today} / 分野 ${topics.length}件` +
      (USE_SMART_SELECTION ? "（農経・食料は必須）" : "（ランダム）") +
      `: ${topics.map((t) => t.labelJa).join("、")}`
  );

  const candidates: ArxivPaper[] = [];

  if (!unpaywallEmail) {
    console.warn("UNPAYWALL_EMAIL（または OPENALEX_MAILTO）がないと PDF 解決が弱くなります。");
  }

  /* ----- arXiv を最初に1回だけ（OpenAlex の前。429 が出にくい） ----- */
  const arxivTopics = pickArxivTopicsForFetch(topics, USE_SMART_SELECTION);
  console.log(`  arXiv 分野（1リクエストに統合）: ${arxivTopics.map((t) => t.labelJa).join("、")}`);
  const arxivPapers = await fetchArxivForTopics(arxivTopics, now);
  candidates.push(...arxivPapers);

  if (mailto) {
    const fromPublicationDate = getJstDateMinusDays(OPENALEX_LOOKBACK_DAYS);
    const openAlexTopics = mergeOpenAlexTopics(topics, USE_SMART_SELECTION);
    for (const topic of openAlexTopics) {
      try {
        const openAlexRaw = await fetchOpenAlexRecentWorks({
          mailto,
          fromPublicationDate,
          searchQuery: topic.openAlexQuery,
          perPage: OPENALEX_PER_TOPIC,
        });
        candidates.push(...openAlexRaw.map((p) => tagTopic(p, topic)));
        console.log(`  OpenAlex [${topic.labelJa}]: ${openAlexRaw.length}件`);
      } catch (error) {
        console.warn(`  OpenAlex [${topic.labelJa}] スキップ:`, error);
      }
      await sleep(OPENALEX_GAP_MS);
    }
  } else {
    console.warn("OPENALEX_MAILTO を .env.local に設定すると、多分野からの収集が安定します。");
  }

  /* ----- Semantic Scholar（arXiv API 失敗時は arXiv ID 付き論文を多めに補完） ----- */
  const semanticTopics =
    arxivPapers.length === 0
      ? shuffleInPlace([...topics]).slice(0, Math.min(3, topics.length))
      : [topics[Math.floor(Math.random() * topics.length)]];

  try {
    await sleep(SEMANTIC_DELAY_MS);
    for (const semanticTopic of semanticTopics) {
      const semanticRaw = await fetchSemanticScholarArxivPapers(
        semanticTopic.semanticQuery,
        SEMANTIC_LIMIT
      );
      candidates.push(
        ...dedupeByArxivId(
          semanticRaw.map((p) => tagTopic({ ...p, source: "arxiv" as const }, semanticTopic))
        )
      );
      console.log(`  Semantic Scholar [${semanticTopic.labelJa}]: ${semanticRaw.length}件`);
      await sleep(1000);
    }
    if (arxivPapers.length === 0 && semanticTopics.length > 1) {
      console.log("  （arXiv API が使えなかったため Semantic Scholar で arXiv 論文を補完しました）");
    }
  } catch (error) {
    console.warn("Semantic Scholar fetch skipped:", error);
  }

  const deduped = dedupeByArxivId(candidates);
  let pool: ArxivPaper[];

  if (USE_SMART_SELECTION) {
    const interestVector = await loadInterestVector();
    const useInterest = process.env.USE_INTEREST_BOOST === "1";
    const selection = await selectWithQuotaMMR(deduped, {
      maxPapers: CANDIDATE_POOL_SIZE,
      todayDate: today,
      now,
      interestVector,
      useInterestBoost: useInterest,
    });
    pool = selection.ordered;
    console.log(
      `候補 ${pool.length}件（農経2+隣接2+セレン1 クォータ）から PDF検証で最大 ${MAX_PAPERS} 件確定…`
    );
    const quotaIds = selection.quotaPicks.map((q) => `${q.paper.id}[${q.categoryL1}]`).join(", ");
    console.log(`  クォータ選定: ${quotaIds}`);
    for (const w of selection.warnings) {
      console.warn(`  [選出警告] ${w}`);
    }
    if (useInterest) {
      console.log("  興味ブースト: ON（data/interest-profile.json）");
    }
  } else {
    pool = shuffleInPlace(deduped).slice(0, CANDIDATE_POOL_SIZE);
    console.log(`候補 ${pool.length}件（シャッフル済み）から PDF取得可能な論文を最大 ${MAX_PAPERS} 件選びます…`);
  }

  const finalList = await selectPapersWithDownloadablePdf(pool, MAX_PAPERS);

  if (finalList.length === 0) {
    throw new Error(
      "PDF本文を取得できる論文が1件もありませんでした。\n" +
        "→ Python の PyMuPDF が入っているか確認してください: `pip install pymupdf`"
    );
  }

  if (finalList.length < MAX_PAPERS) {
    console.warn(`PDF本文取得可能 ${finalList.length} 件のみ（目標 ${MAX_PAPERS} 件）`);
  }

  const papers = finalList.map((p) => toPaperSchema(p));

  const outputPath = `${DATA_DIR}/${today}.json`;
  await writeJsonFileAtomic(outputPath, { date: today, papers });
  await updateIndex(today);

  console.log(`Saved ${papers.length} papers (多分野・PDF検証済み) to ${outputPath}`);
}

main().catch((error) => {
  console.error("fetch-papers failed:", error);
  process.exit(1);
});
