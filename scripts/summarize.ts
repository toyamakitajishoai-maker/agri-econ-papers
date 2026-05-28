import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";

loadEnv({ path: ".env.local" });
loadEnv();

import { buildAudioForPaper, isAudioFresh, isReadyForAudio } from "@/lib/buildAudio";
import { extractPdfTextExcerpt } from "@/lib/extractPdfText";
import { isWeakPdfUrl, resolvePdfUrl } from "@/lib/pdfResolve";
import { summarizeAbstractWithGemini } from "@/lib/gemini";
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
  if (!s.why?.trim()) return true;
  if (paper.abstract && (novelty === paper.abstract || results === paper.abstract)) return true;
  return false;
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

  const summarizedPapers: Paper[] = [];
  let skipped = 0;
  let processed = 0;
  const toProcess = force ? papers.length : papers.filter((p) => needsSummarize(p)).length;

  console.log(`要約開始: ${date}（対象 ${toProcess} 件 / 全 ${papers.length} 件）`);

  async function saveProgress() {
    const remaining = papers.slice(summarizedPapers.length);
    await writeJsonFileAtomic(filePath, {
      date: parsed.date ?? date,
      papers: [...summarizedPapers, ...remaining],
    });
  }

  for (let i = 0; i < papers.length; i += 1) {
    const paper = papers[i];

    if (!force && !needsSummarize(paper)) {
      skipped += 1;
      summarizedPapers.push(paper);
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

    const result = await summarizeAbstractWithGemini(toArxivPaper(paper), apiKey, 3, pdfExcerpt);
    processed += 1;
    const updatedPaper: Paper = {
      ...paper,
      pdfUrl: resolvedPdfUrl || paper.pdfUrl,
      titleJa: result.titleJa ?? paper.titleJa,
      catchTitle: result.catchTitle ?? paper.catchTitle,
      hook: result.hook ?? paper.hook,
      quiz: result.quiz ?? paper.quiz,
      limitations: pdfExcerpt ? (result.limitations ?? "") : paper.limitations,
      glossary: result.glossary ?? paper.glossary,
      takeaway: result.takeaway ?? paper.takeaway,
      summary: result.summary,
    };

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
    console.log(
      `  → 完了 (${elapsedSec}s) catchTitle: ${result.catchTitle ? "あり" : "なし"}${limNote ? ` ${limNote}` : ""}${glossaryNote}${audioNote}`
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
