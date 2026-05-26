import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { KeyFigure, Paper } from "@/lib/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_FETCH_TIMEOUT_MS = Number(process.env.GEMINI_FETCH_TIMEOUT_MS ?? 90_000);
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_PAGES_TO_SCAN = 10;
const PAGE_RENDER_SCALE = 1.1;
const FIGURES_DIR = path.join(process.cwd(), "public", "figures");

type PageImage = {
  page: number;
  buffer: Buffer;
};

type GeminiVisionResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeFigureFilename(paperId: string): string {
  return paperId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function downloadPdf(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "agri-econ-papers/1.0 (research summary; mailto:research@local)",
        Accept: "application/pdf,*/*",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf") && !url.toLowerCase().includes(".pdf")) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES) return null;
    if (buffer.subarray(0, 4).toString() !== "%PDF") return null;

    return buffer;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function renderPdfPages(pdfBuffer: Buffer): Promise<PageImage[]> {
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

function parseSelectionJson(raw: string): { page: number; caption: string } | null {
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

export async function selectKeyFigurePage(
  pages: PageImage[],
  paperTitle: string,
  apiKey: string
): Promise<{ page: number; caption: string } | null> {
  if (pages.length === 0) return null;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: [
        `論文「${paperTitle.slice(0, 120)}」のPDFページ画像です。`,
        "研究の主要な結果（グラフ・表・地図・モデル図など）が最もよく示されているページを1つ選んでください。",
        "表紙・著者紹介・参考文献リストだけのページは避けてください。",
        "JSONのみ返してください: {\"page\": ページ番号, \"caption\": \"80字以内の説明（です・ます調）\"}",
      ].join("\n"),
    },
  ];

  for (const { page, buffer } of pages) {
    parts.push({ text: `--- ページ ${page} ---` });
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: buffer.toString("base64"),
      },
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
    return parseSelectionJson(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractKeyFigureForPaper(paper: Paper, apiKey: string): Promise<KeyFigure | null> {
  if (!paper.pdfUrl?.trim()) return null;

  const pdfBuffer = await downloadPdf(paper.pdfUrl);
  if (!pdfBuffer) return null;

  const pages = await renderPdfPages(pdfBuffer);
  if (pages.length === 0) return null;

  const selection = await selectKeyFigurePage(pages, paper.title, apiKey);
  if (!selection) return null;

  const chosen =
    pages.find((p) => p.page === selection.page) ??
    pages.reduce((best, p) => (p.page <= selection.page ? p : best), pages[0]);

  await mkdir(FIGURES_DIR, { recursive: true });
  const filename = `${safeFigureFilename(paper.id)}.png`;
  const diskPath = path.join(FIGURES_DIR, filename);
  await writeFile(diskPath, chosen.buffer);

  return {
    imagePath: `/figures/${filename}`,
    page: chosen.page,
    caption: selection.caption,
    extractedAt: new Date().toISOString(),
  };
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
