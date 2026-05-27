import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  selectBestFigureFromCaptions,
  selectFiguresForSections,
  type FigureCandidate,
} from "@/lib/selectFigure";
import type { KeyFigure, Paper } from "@/lib/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_FETCH_TIMEOUT_MS = Number(process.env.GEMINI_FETCH_TIMEOUT_MS ?? 90_000);
import { downloadPdfForPaper, downloadPdfFromUrl, type PdfResolveInput } from "@/lib/pdfResolve";

const MAX_PAGES_TO_SCAN = 10;
const PAGE_RENDER_SCALE = 1.1;
const FIGURES_DIR = path.join(process.cwd(), "public", "figures");
const TMP_DIR = path.join(process.cwd(), ".tmp-figures");

type PageImage = { page: number; buffer: Buffer };

type GeminiVisionResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

type PythonExtractResult = {
  candidates?: FigureCandidate[];
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeFigureFilename(paperId: string): string {
  return paperId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** @deprecated downloadPdfFromUrl / downloadPdfForPaper を使用 */
export async function downloadPdf(url: string): Promise<Buffer | null> {
  return downloadPdfFromUrl(url);
}

export async function downloadPdfForPaperRecord(paper: PdfResolveInput): Promise<Buffer | null> {
  const { buffer } = await downloadPdfForPaper(paper);
  return buffer;
}

function runPythonExtractor(pdfPath: string, outputDir: string): Promise<PythonExtractResult> {
  return new Promise((resolve) => {
    const script = path.join(process.cwd(), "scripts", "extract_figures.py");
    const pythonBin = process.env.PYTHON_BIN?.trim() || "python3";
    const proc = spawn(pythonBin, [script, pdfPath, outputDir], {
      cwd: process.cwd(),
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({ candidates: [], error: stderr || `exit ${code}` });
        return;
      }
      try {
        const lastLine = stdout.trim().split("\n").pop() ?? "{}";
        resolve(JSON.parse(lastLine) as PythonExtractResult);
      } catch {
        resolve({ candidates: [], error: "invalid json from python" });
      }
    });
    proc.on("error", () => resolve({ candidates: [], error: "python3 not found" }));
  });
}

async function extractWithPyMuPDF(
  pdfBuffer: Buffer,
  paper: Paper,
  apiKey: string
): Promise<KeyFigure | null> {
  const pdfPath = path.join(process.cwd(), ".tmp-figure.pdf");
  const workDir = path.join(TMP_DIR, safeFigureFilename(paper.id));

  await mkdir(workDir, { recursive: true });
  await writeFile(pdfPath, pdfBuffer);

  try {
    const result = await runPythonExtractor(pdfPath, workDir);
    const candidates = result.candidates ?? [];
    if (candidates.length === 0) return null;

    const chosen = await selectBestFigureFromCaptions(candidates, paper, apiKey);
    if (!chosen) return null;

    await mkdir(FIGURES_DIR, { recursive: true });
    const ext = path.extname(chosen.imageFile) || ".png";
    const filename = `${safeFigureFilename(paper.id)}${ext}`;
    const src = path.join(workDir, chosen.imageFile);
    const dest = path.join(FIGURES_DIR, filename);
    await copyFile(src, dest);

    return {
      imagePath: `/figures/${filename}`,
      page: chosen.page,
      caption: chosen.caption,
      label: chosen.label,
      source: "pdf-image",
      extractedAt: new Date().toISOString(),
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    await import("node:fs/promises").then(({ unlink }) =>
      unlink(pdfPath).catch(() => undefined)
    );
  }
}

async function renderPdfPages(pdfBuffer: Buffer): Promise<PageImage[]> {
  const { pdf } = await import("pdf-to-img");
  const tmpPath = path.join(process.cwd(), ".tmp-figure.pdf");
  await writeFile(tmpPath, pdfBuffer);

  const pages: PageImage[] = [];
  let pageNum = 0;

  try {
    const document = await pdf(tmpPath, { scale: PAGE_RENDER_SCALE });
    for await (const image of document) {
      pageNum += 1;
      if (pageNum === 1) continue;
      if (pages.length >= MAX_PAGES_TO_SCAN) break;
      pages.push({ page: pageNum, buffer: Buffer.from(image) });
    }
  } finally {
    await import("node:fs/promises").then(({ unlink }) =>
      unlink(tmpPath).catch(() => undefined)
    );
  }

  return pages;
}

function parsePageSelectionJson(raw: string): { page: number; caption: string } | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { page?: unknown; caption?: unknown };
    const page = typeof parsed.page === "number" ? parsed.page : Number(parsed.page);
    const caption = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
    if (!Number.isFinite(page) || page < 1 || !caption) return null;
    return { page, caption };
  } catch {
    return null;
  }
}

async function selectKeyFigurePageFallback(
  pages: PageImage[],
  paperTitle: string,
  apiKey: string
): Promise<{ page: number; caption: string } | null> {
  if (pages.length === 0) return null;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: [
        `論文「${paperTitle.slice(0, 120)}」のPDFページ画像です。`,
        "研究の主要な結果（グラフ・表・地図）が最もよく示されているページを1つ選んでください。",
        "JSONのみ: {\"page\": 番号, \"caption\": \"説明（です・ます調）\"}",
      ].join("\n"),
    },
  ];

  for (const { page, buffer } of pages) {
    parts.push({ text: `--- ページ ${page} ---` });
    parts.push({
      inlineData: { mimeType: "image/png", data: buffer.toString("base64") },
    });
  }

  const endpoint = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as GeminiVisionResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parsePageSelectionJson(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function extractWithPageFallback(
  pdfBuffer: Buffer,
  paper: Paper,
  apiKey: string
): Promise<KeyFigure | null> {
  const pages = await renderPdfPages(pdfBuffer);
  if (pages.length === 0) return null;

  const selection = await selectKeyFigurePageFallback(pages, paper.title, apiKey);
  if (!selection) return null;

  const chosen =
    pages.find((p) => p.page === selection.page) ??
    pages.reduce((best, p) => (p.page <= selection.page ? p : best), pages[0]);

  await mkdir(FIGURES_DIR, { recursive: true });
  const filename = `${safeFigureFilename(paper.id)}.png`;
  await writeFile(path.join(FIGURES_DIR, filename), chosen.buffer);

  return {
    imagePath: `/figures/${filename}`,
    page: chosen.page,
    caption: selection.caption,
    source: "pdf-page",
    extractedAt: new Date().toISOString(),
  };
}

/** 図表なしでも安全に null を返す */
export async function extractKeyFigureForPaper(
  paper: Paper,
  apiKey: string
): Promise<KeyFigure | null> {
  const { buffer: pdfBuffer } = await downloadPdfForPaper({
    doi: paper.doi,
    pdfUrl: paper.pdfUrl,
    id: paper.id,
    source: paper.source,
  });
  if (!pdfBuffer) return null;

  const fromPython = await extractWithPyMuPDF(pdfBuffer, paper, apiKey);
  if (fromPython) return fromPython;

  return extractWithPageFallback(pdfBuffer, paper, apiKey);
}

export async function extractKeyFigureWithRetry(
  paper: Paper,
  apiKey: string,
  retryCount = 2
): Promise<KeyFigure | null> {
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    const result = await extractKeyFigureForPaper(paper, apiKey);
    if (result) return result;
    if (attempt < retryCount) await sleep(1500);
  }
  return null;
}

/**
 * Python抽出で得た候補を、results用 / why用 の2枚に振り分けて保存する。
 * 同じ候補が両方に当たった場合は1枚だけにまとめる。
 */
async function extractSectionFiguresWithPyMuPDF(
  pdfBuffer: Buffer,
  paper: Paper,
  apiKey: string
): Promise<KeyFigure[]> {
  const pdfPath = path.join(process.cwd(), `.tmp-figure-${safeFigureFilename(paper.id)}.pdf`);
  const workDir = path.join(TMP_DIR, safeFigureFilename(paper.id));

  await mkdir(workDir, { recursive: true });
  await writeFile(pdfPath, pdfBuffer);

  try {
    const result = await runPythonExtractor(pdfPath, workDir);
    const candidates = result.candidates ?? [];
    if (candidates.length === 0) return [];

    const selection = await selectFiguresForSections(candidates, paper, apiKey);
    const figures: KeyFigure[] = [];

    await mkdir(FIGURES_DIR, { recursive: true });

    async function saveOne(
      candidate: FigureCandidate,
      purpose: "results" | "why"
    ): Promise<KeyFigure | null> {
      const ext = path.extname(candidate.imageFile) || ".png";
      const filename = `${safeFigureFilename(paper.id)}_${purpose}${ext}`;
      const src = path.join(workDir, candidate.imageFile);
      const dest = path.join(FIGURES_DIR, filename);
      try {
        await copyFile(src, dest);
      } catch {
        return null;
      }
      return {
        imagePath: `/figures/${filename}`,
        page: candidate.page,
        caption: candidate.caption,
        label: candidate.label,
        source: "pdf-image",
        purpose,
        extractedAt: new Date().toISOString(),
      };
    }

    if (selection.results) {
      const fig = await saveOne(selection.results, "results");
      if (fig) figures.push(fig);
    }
    if (selection.why && selection.why.id !== selection.results?.id) {
      const fig = await saveOne(selection.why, "why");
      if (fig) figures.push(fig);
    }

    return figures;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    await import("node:fs/promises").then(({ unlink }) =>
      unlink(pdfPath).catch(() => undefined)
    );
  }
}

/** results用と why用 の図表をまとめて抽出（最大2枚） */
export async function extractSectionFiguresForPaper(
  paper: Paper,
  apiKey: string
): Promise<KeyFigure[]> {
  const { buffer: pdfBuffer } = await downloadPdfForPaper({
    doi: paper.doi,
    pdfUrl: paper.pdfUrl,
    id: paper.id,
    source: paper.source,
  });
  if (!pdfBuffer) return [];

  return extractSectionFiguresWithPyMuPDF(pdfBuffer, paper, apiKey);
}

export async function extractSectionFiguresWithRetry(
  paper: Paper,
  apiKey: string,
  retryCount = 2
): Promise<KeyFigure[]> {
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    const figures = await extractSectionFiguresForPaper(paper, apiKey);
    if (figures.length > 0) return figures;
    if (attempt < retryCount) await sleep(1500);
  }
  return [];
}
