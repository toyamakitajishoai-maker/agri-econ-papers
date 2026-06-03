import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { buildAudioForPaper, isAudioFresh, isReadyForAudio } from "@/lib/buildAudio";
import { extractPdfTextExcerpt } from "@/lib/extractPdfText";
import { isWeakPdfUrl, resolvePdfUrl } from "@/lib/pdfResolve";
import { classifyFromPaper } from "@/lib/classifyPaper";
import { summarizeAbstractWithGemini } from "@/lib/gemini";
import type { GeminiV2SummaryResult } from "@/lib/geminiV2";
import { generateAnalogyForPaper, needsAnalogy } from "@/lib/generateAnalogy";
import {
  isSummarizeArticleV2Enabled,
  needsArticleV2Fields,
  summarizeWithGeminiV2,
} from "@/lib/geminiV2";
import { estimateReadingTimeSecV2 } from "@/lib/readingTime";
import { writeJsonFileAtomic } from "@/lib/safeWriteJson";
import { isAcademicSummary } from "@/lib/summary";
import type { ArxivPaper } from "@/lib/arxiv";
import type { Paper } from "@/lib/types";

const DATA_DIR = "data";

function getTodayJstString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toArxivPaper(paper: Paper): ArxivPaper {
  return {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract,
    authors: paper.authors,
    publishedAt: paper.publishedAt,
    url: paper.url,
    pdfUrl: paper.pdfUrl,
    categories: paper.categories,
    doi: paper.doi,
    source: paper.source,
    journal: paper.journal,
  };
}

/** fetch 直後・旧形式・失敗時は要約が必要 */
function needsSummarize(paper: Paper): boolean {
  const s = paper.summary;
  if (!isAcademicSummary(s)) return true;

  const { gist, novelty, results } = s;
  if (gist === "要約準備中") return true;
  if (gist.startsWith("要約生成に失敗")) return true;
  if (gist.startsWith("同分野の新着")) return true;
  if (!paper.catchTitle?.trim() || !paper.hook?.trim()) return true;
  if (!s.figures?.trim()) return true;
  if (!paper.quiz?.question) return true;
  if (paper.pdfUrl?.trim() && paper.limitations === undefined) return true;
  if (!paper.glossary?.length) return true;
  if (!paper.takeaway?.whatIsIt) return true;
  if (!paper.storyCards?.ask) return true;
  if (!s.why?.trim()) return true;
  if (paper.abstract && (novelty === paper.abstract || results === paper.abstract)) return true;
  return false;
}

function needsProcessing(paper: Paper, useV2: boolean): boolean {
  if (needsSummarize(paper)) return true;
  if (needsAnalogy(paper)) return true;
  if (useV2 && needsArticleV2Fields(paper)) return true;
  return false;
}

async function ensureAnalogyOnPaper(
  paper: Paper,
  arxiv: ArxivPaper,
  apiKey: string
): Promise<Paper> {
  if (!needsAnalogy(paper)) return paper;
  console.log("  たとえると: 比喩を生成中…");
  const analogy = await generateAnalogyForPaper(arxiv, apiKey, {
    oneLiner: paper.oneLiner ?? paper.hook ?? paper.summary.gist,
    mechanism: paper.summary?.why,
    categoryL1: paper.categoryL1,
  });
  if (!analogy) return paper;
  return {
    ...paper,
    analogy,
    analogyNeedsReview: false,
    useArticleV2: paper.useArticleV2 ?? true,
  };
}

function applyV2ResultToPaper(
  paper: Paper,
  result: GeminiV2SummaryResult,
  pdfExcerpt: string | null,
  resolvedPdfUrl: string
): Paper {
  const merged: Paper = {
    ...paper,
    pdfUrl: resolvedPdfUrl || paper.pdfUrl,
    titleJa: result.titleJa ?? paper.titleJa,
    catchTitle: result.catchTitle ?? paper.catchTitle,
    hook: result.hook ?? paper.hook,
    hookLead: result.hookLead ?? paper.hookLead,
    background: result.background ?? paper.background,
    threeLineSummary: result.threeLineSummary ?? paper.threeLineSummary,
    quiz: result.quiz ?? paper.quiz,
    limitations: pdfExcerpt ? (result.limitations ?? "") : paper.limitations,
    glossary: result.glossary ?? paper.glossary,
    takeaway: result.takeaway ?? paper.takeaway,
    storyCards: result.storyCards ?? paper.storyCards,
    summary: result.summary,
    useArticleV2: true,
    oneLiner: result.oneLiner ?? paper.oneLiner,
    noveltyContrast: result.noveltyContrast ?? paper.noveltyContrast,
    analogy: result.analogy ?? paper.analogy,
    kpi: result.kpi ?? paper.kpi,
    whyYouCare: result.whyYouCare ?? paper.whyYouCare,
    takeawayTalk: result.takeawayTalk ?? paper.takeawayTalk,
    bodyText: result.bodyText ?? paper.bodyText,
    bodyGlossary: result.bodyGlossary ?? paper.bodyGlossary,
    glossarySpans: result.glossarySpans ?? paper.glossarySpans,
    agriEconRelevance: result.agriEconRelevance ?? paper.agriEconRelevance,
    analogyNeedsReview: result.analogy?.body?.trim() ? false : result.analogyNeedsReview,
    ...(() => {
      const c = classifyFromPaper({
        ...paper,
        categoryL1: result.categoryL1 ?? paper.categoryL1,
        categoryL2: result.categoryL2 ?? paper.categoryL2,
      });
      return {
        categoryL1: result.categoryL1 ?? c.categoryL1,
        categoryL2: result.categoryL2 ?? c.categoryL2,
        arxivPrimary: c.arxivPrimary,
      };
    })(),
  };
  merged.readingTimeSec = estimateReadingTimeSecV2(merged);
  return merged;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const date = process.argv[2] ?? getTodayJstString();
  const filePath = `${DATA_DIR}/${date}.json`;
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    throw new Error(`${filePath} が見つかりません。先に npm run fetch を実行してください。`);
  }
  if (!raw.trim()) {
    throw new Error(
      `${filePath} が空です（保存途中で止まった可能性があります）。npm run fetch で取り直してください。`
    );
  }
  let parsed: { date: string; papers: Paper[] };
  try {
    parsed = JSON.parse(raw) as { date: string; papers: Paper[] };
  } catch {
    throw new Error(`${filePath} が壊れています。npm run fetch で取り直してください。`);
  }
  const papers = parsed.papers ?? [];

  const force = process.env.FORCE_SUMMARIZE === "1" || process.env.FORCE_SUMMARIZE === "true";
  const useV2 = isSummarizeArticleV2Enabled();

  const summarizedPapers: Paper[] = [];
  let skipped = 0;
  let processed = 0;
  const toProcess = force
    ? papers.length
    : papers.filter((p) => needsProcessing(p, useV2)).length;

  console.log(
    `要約開始: ${date}（対象 ${toProcess} 件 / 全 ${papers.length} 件${useV2 ? " · 記事v2" : ""}）`
  );

  async function saveProgress() {
    const remaining = papers.slice(summarizedPapers.length);
    await writeJsonFileAtomic(filePath, {
      date: parsed.date ?? date,
      papers: [...summarizedPapers, ...remaining],
    });
  }

  for (let i = 0; i < papers.length; i += 1) {
    const paper = papers[i];

    const onlyAnalogy =
      !force &&
      needsAnalogy(paper) &&
      !needsSummarize(paper) &&
      Boolean(paper.oneLiner?.trim() && paper.bodyText?.trim());

    if (!force && !needsProcessing(paper, useV2)) {
      skipped += 1;
      summarizedPapers.push(paper);
      continue;
    }

    if (onlyAnalogy) {
      processed += 1;
      const label = paper.titleJa ?? paper.title;
      const shortTitle = label.length > 48 ? `${label.slice(0, 48)}…` : label;
      console.log(`[${processed}/${toProcess}] 比喩のみ生成: ${shortTitle}`);
      const arxivOnly = toArxivPaper(paper);
      const withAnalogy = await ensureAnalogyOnPaper(paper, arxivOnly, apiKey);
      summarizedPapers.push(withAnalogy);
      await saveProgress();
      await sleep(Number(process.env.SUMMARIZE_GAP_MS ?? 2500));
      continue;
    }

    const label = paper.titleJa ?? paper.title;
    const shortTitle = label.length > 48 ? `${label.slice(0, 48)}…` : label;
    console.log(`[${processed + 1}/${toProcess}] 要約中: ${shortTitle}`);
    const started = Date.now();

    let pdfExcerpt: string | null = null;
    let resolvedPdfUrl = paper.pdfUrl?.trim() ?? "";
    if (!resolvedPdfUrl || isWeakPdfUrl(resolvedPdfUrl)) {
      const resolved = await resolvePdfUrl({
        doi: paper.doi,
        pdfUrl: paper.pdfUrl,
        id: paper.id,
        source: paper.source,
      });
      if (resolved) resolvedPdfUrl = resolved;
    }

    if (resolvedPdfUrl) {
      console.log("  PDF本文を取得中…");
      const pdfResult = await extractPdfTextExcerpt({
        doi: paper.doi,
        pdfUrl: resolvedPdfUrl,
        id: paper.id,
        source: paper.source,
      });
      pdfExcerpt = pdfResult.excerpt;
      if (pdfResult.pdfUrl) resolvedPdfUrl = pdfResult.pdfUrl;
      if (pdfExcerpt) {
        console.log(`  PDF抜粋: ${pdfExcerpt.length}字 (${resolvedPdfUrl.slice(0, 56)}…)`);
      } else {
        const reasonText =
          pdfResult.failureReason === "download-failed"
            ? "PDFダウンロード失敗"
            : pdfResult.failureReason === "too-short"
              ? `本文が短すぎ（${pdfResult.chars ?? 0}字）`
              : pdfResult.failureReason === "disabled"
                ? "PDF利用が無効化されています"
                : "本文抽出に失敗";
        const detail = pdfResult.detail ? ` — ${pdfResult.detail.slice(0, 160)}` : "";
        console.log(`  PDF抜粋: 取得できず（${reasonText}${detail}）`);
      }
    }

    const arxiv = toArxivPaper(paper);
    const result = useV2
      ? await summarizeWithGeminiV2(arxiv, apiKey, 3, pdfExcerpt)
      : await summarizeAbstractWithGemini(arxiv, apiKey, 3, pdfExcerpt);
    processed += 1;
    let updatedPaper: Paper = useV2
      ? applyV2ResultToPaper(paper, result as GeminiV2SummaryResult, pdfExcerpt, resolvedPdfUrl)
      : {
          ...paper,
          pdfUrl: resolvedPdfUrl || paper.pdfUrl,
          titleJa: result.titleJa ?? paper.titleJa,
          catchTitle: result.catchTitle ?? paper.catchTitle,
          hook: result.hook ?? paper.hook,
          quiz: result.quiz ?? paper.quiz,
          limitations: pdfExcerpt ? (result.limitations ?? "") : paper.limitations,
          glossary: result.glossary ?? paper.glossary,
          takeaway: result.takeaway ?? paper.takeaway,
          storyCards: result.storyCards ?? paper.storyCards,
          summary: result.summary,
        };

    updatedPaper = await ensureAnalogyOnPaper(updatedPaper, arxiv, apiKey);

    // 音声化（無効化したい場合は SKIP_AUDIO=1）
    let audioNote = "";
    if (process.env.SKIP_AUDIO !== "1" && isReadyForAudio(updatedPaper) && !isAudioFresh(updatedPaper.audio)) {
      try {
        const { audio, bytes } = await buildAudioForPaper(updatedPaper, apiKey);
        updatedPaper.audio = audio;
        audioNote = ` 音声:${audio.duration ?? "?"}s/${(bytes / 1024).toFixed(0)}KB`;
      } catch (e) {
        audioNote = ` 音声:失敗(${e instanceof Error ? e.message.slice(0, 60) : "?"})`;
      }
    }

    summarizedPapers.push(updatedPaper);

    const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
    const limNote = pdfExcerpt
      ? result.limitations?.trim()
        ? "限界:あり"
        : "限界:記述なし"
      : "";
    const glossaryNote = result.glossary?.length ? ` 用語:${result.glossary.length}件` : "";
    const v2Note = useV2
      ? ` v2:${(result as GeminiV2SummaryResult).oneLiner ? "oneLiner" : "—"}/spans:${(result as GeminiV2SummaryResult).glossarySpans?.length ?? 0}`
      : "";
    console.log(
      `  → 完了 (${elapsedSec}s) catchTitle: ${result.catchTitle ? "あり" : "なし"}${limNote ? ` ${limNote}` : ""}${glossaryNote}${v2Note}${audioNote}`
    );

    await saveProgress();
    await sleep(Number(process.env.SUMMARIZE_GAP_MS ?? 2500));
  }

  console.log(
    `Done: ${processed} newly summarized, ${skipped} unchanged in ${filePath}` +
      (skipped > 0 && !force ? " (すべてやり直すときは FORCE_SUMMARIZE=1)" : "")
  );
}

main().catch((error) => {
  console.error("summarize failed:", error);
  process.exit(1);
});
