import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { downloadPdfForPaper, type PdfResolveInput } from "@/lib/pdfResolve";

const TMP_DIR = path.join(process.cwd(), ".tmp-pdf-text");
const MIN_EXCERPT_CHARS = 400;

type PythonTextResult = {
  excerpt?: string;
  chars?: number;
  error?: string;
};

function getPythonBin(): string {
  return process.env.PYTHON_BIN?.trim() || "python3";
}

function runPythonTextExtractor(pdfPath: string): Promise<PythonTextResult> {
  return new Promise((resolve) => {
    const script = path.join(process.cwd(), "scripts", "extract_pdf_text.py");
    const proc = spawn(getPythonBin(), [script, pdfPath], { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    proc.on("error", (err) => {
      resolve({ excerpt: "", error: `python起動失敗: ${err.message}` });
    });
    proc.stdout.on("data", (d) => {
      stdout += String(d);
    });
    proc.stderr.on("data", (d) => {
      stderr += String(d);
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({ excerpt: "", error: stderr || `exit ${code}` });
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()) as PythonTextResult);
      } catch {
        resolve({ excerpt: "", error: "invalid json from python" });
      }
    });
  });
}

export type PdfExcerptResult = {
  excerpt: string | null;
  pdfUrl: string | null;
  /** 失敗理由（ログ表示用） */
  failureReason?: "download-failed" | "extract-failed" | "too-short" | "disabled";
  /** Python からのエラーメッセージ等（デバッグ用） */
  detail?: string;
  /** Python が実際に取れた抜粋の文字数（短すぎてもログ用に残す） */
  chars?: number;
};

/** オープンアクセス PDF から要約用の本文抜粋を取得 */
export async function extractPdfTextExcerpt(
  input: PdfResolveInput | string
): Promise<PdfExcerptResult> {
  if (process.env.USE_PDF_FOR_SUMMARY === "0") {
    return { excerpt: null, pdfUrl: null, failureReason: "disabled" };
  }

  const resolveInput: PdfResolveInput =
    typeof input === "string" ? { pdfUrl: input } : input;

  const { buffer: pdfBuffer, pdfUrl } = await downloadPdfForPaper(resolveInput);
  if (!pdfBuffer) {
    return {
      excerpt: null,
      pdfUrl: pdfUrl ?? resolveInput.pdfUrl ?? null,
      failureReason: "download-failed",
    };
  }

  await mkdir(TMP_DIR, { recursive: true });
  const pdfPath = path.join(TMP_DIR, `source-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.pdf`);

  try {
    await writeFile(pdfPath, pdfBuffer);
    const result = await runPythonTextExtractor(pdfPath);
    const excerpt = result.excerpt?.trim() ?? "";
    const chars = excerpt.length;

    if (result.error || excerpt.length === 0) {
      return {
        excerpt: null,
        pdfUrl: pdfUrl ?? null,
        failureReason: "extract-failed",
        detail: result.error,
        chars,
      };
    }
    if (chars < MIN_EXCERPT_CHARS) {
      return {
        excerpt: null,
        pdfUrl: pdfUrl ?? null,
        failureReason: "too-short",
        chars,
      };
    }
    return { excerpt, pdfUrl: pdfUrl ?? null, chars };
  } catch (e) {
    return {
      excerpt: null,
      pdfUrl: pdfUrl ?? null,
      failureReason: "extract-failed",
      detail: (e as Error).message,
    };
  } finally {
    await rm(pdfPath, { force: true }).catch(() => undefined);
  }
}
