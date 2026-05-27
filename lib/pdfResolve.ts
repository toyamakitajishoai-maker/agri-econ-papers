import { lookupOpenAccessPdfUrls } from "@/lib/unpaywall";

const OPENALEX_BASE = "https://api.openalex.org";
const MAX_PDF_BYTES = 15 * 1024 * 1024;

export type PdfResolveInput = {
  doi?: string;
  pdfUrl?: string;
  id?: string;
  source?: string;
};

function getMailto(): string {
  return (process.env.UNPAYWALL_EMAIL ?? process.env.OPENALEX_MAILTO ?? "research@local").trim();
}

function normalizeDoi(raw?: string): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().replace(/^https?:\/\/doi\.org\//i, "");
  return s.length > 0 ? s : null;
}

/** 明らかに PDF 直リンクではない URL */
export function isWeakPdfUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u.startsWith("http")) return true;
  if (u.includes("doi.org/")) return true;
  if (u.includes("hdl.handle.net/")) return true;
  if (u.includes("catalog.lib.") && !u.includes(".pdf")) return true;
  return false;
}

/** PDF 直リンクの可能性が高い URL */
export function isStrongPdfUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u.startsWith("http") || isWeakPdfUrl(url)) return false;
  if (u.endsWith(".pdf")) return true;
  if (u.includes("/download/") || u.includes("/article/download/")) return true;
  if (u.includes("/content/pdf/")) return true;
  if (u.includes("arxiv.org/pdf/")) return true;
  if (u.includes("frontiersin.org") && u.includes("/pdf")) return true;
  if (u.includes("dergipark.org.tr") && u.includes("/download/")) return true;
  return false;
}

function scorePdfCandidate(url: string): number {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return -1000;
  let score = 0;
  if (isWeakPdfUrl(u)) score -= 200;
  if (isStrongPdfUrl(u)) score += 120;
  if (/\.pdf(\?|$)/i.test(u)) score += 80;
  if (/\/download\//i.test(u)) score += 50;
  if (/url_for_pdf/i.test(u)) score += 30;
  if (u.includes("arxiv.org/pdf/")) score += 100;
  if (u.includes("link.springer.com/content/pdf/")) score += 90;
  if (u.includes("frontiersin.org") && u.includes("/pdf")) score += 85;
  return score;
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = raw.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out.sort((a, b) => scorePdfCandidate(b) - scorePdfCandidate(a));
}

async function fetchOpenAlexPdfCandidates(doi: string, mailto: string): Promise<string[]> {
  const clean = normalizeDoi(doi);
  if (!clean) return [];

  const url = `${OPENALEX_BASE}/works/doi:${encodeURIComponent(clean)}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": `mailto:${mailto}`,
      },
    });
    if (!res.ok) return [];

    const work = (await res.json()) as {
      open_access?: { oa_url?: string | null; any_repository_has_fulltext?: boolean };
      primary_location?: { pdf_url?: string | null; landing_page_url?: string | null };
      locations?: Array<{ pdf_url?: string | null; landing_page_url?: string | null }>;
      best_oa_location?: { pdf_url?: string | null; url?: string | null };
    };

    const urls: string[] = [];
    const oa = work.open_access?.oa_url?.trim();
    if (oa) urls.push(oa);
    const primaryPdf = work.primary_location?.pdf_url?.trim();
    if (primaryPdf) urls.push(primaryPdf);
    const bestPdf = work.best_oa_location?.pdf_url?.trim();
    if (bestPdf) urls.push(bestPdf);
    const bestUrl = work.best_oa_location?.url?.trim();
    if (bestUrl) urls.push(bestUrl);
    for (const loc of work.locations ?? []) {
      if (loc.pdf_url?.trim()) urls.push(loc.pdf_url.trim());
    }
    return dedupeUrls(urls);
  } catch {
    return [];
  }
}

function arxivPdfFromId(id: string): string | null {
  const m = id.match(/(\d{4}\.\d{4,5})/);
  if (m) return `https://arxiv.org/pdf/${m[1]}.pdf`;
  return null;
}

/**
 * 論文から PDF 直リンク候補を収集（強い候補順）
 */
export async function collectPdfUrlCandidates(input: PdfResolveInput): Promise<string[]> {
  const mailto = getMailto();
  const doi = normalizeDoi(input.doi);
  const urls: string[] = [];

  const existing = input.pdfUrl?.trim();
  if (existing) urls.push(existing);

  const arxivPdf = input.id ? arxivPdfFromId(input.id) : null;
  if (arxivPdf) urls.push(arxivPdf);

  if (doi && mailto) {
    const fromUnpaywall = await lookupOpenAccessPdfUrls(doi, mailto);
    urls.push(...fromUnpaywall);
    const fromOpenAlex = await fetchOpenAlexPdfCandidates(doi, mailto);
    urls.push(...fromOpenAlex);
  }

  return dedupeUrls(urls);
}

/** 最も信頼できる PDF URL を1件返す */
export async function resolvePdfUrl(input: PdfResolveInput): Promise<string | null> {
  const candidates = await collectPdfUrlCandidates(input);
  const strong = candidates.find((u) => isStrongPdfUrl(u));
  if (strong) return strong;
  const notWeak = candidates.find((u) => !isWeakPdfUrl(u));
  return notWeak ?? candidates[0] ?? null;
}

function pdfFetchHeaders(url: string): Record<string, string> {
  const mailto = getMailto();
  let origin = "";
  try {
    origin = new URL(url).origin + "/";
  } catch {
    origin = "";
  }
  return {
    "User-Agent": `agri-econ-papers/1.0 (mailto:${mailto})`,
    Accept: "application/pdf,application/octet-stream,*/*;q=0.8",
    ...(origin ? { Referer: origin } : {}),
  };
}

function looksLikePdfBuffer(buffer: Buffer, contentType: string, url: string): boolean {
  if (buffer.length < 100 || buffer.length > MAX_PDF_BYTES) return false;
  if (buffer.subarray(0, 4).toString() === "%PDF") return true;
  const ct = contentType.toLowerCase();
  if (ct.includes("application/pdf")) return true;
  if (ct.includes("octet-stream") && (url.toLowerCase().includes(".pdf") || /\/download\//i.test(url))) {
    return buffer.subarray(0, 4).toString() === "%PDF";
  }
  return false;
}

/** 単一 URL から PDF を取得 */
export async function downloadPdfFromUrl(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: pdfFetchHeaders(url),
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!looksLikePdfBuffer(buffer, contentType, url)) return null;
    return buffer;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 候補 URL を順に試して PDF を取得。成功した URL も返す */
export async function downloadPdfForPaper(
  input: PdfResolveInput
): Promise<{ buffer: Buffer | null; pdfUrl: string | null }> {
  const candidates = await collectPdfUrlCandidates(input);
  for (const url of candidates) {
    const buffer = await downloadPdfFromUrl(url);
    if (buffer) {
      return { buffer, pdfUrl: url };
    }
  }
  return { buffer: null, pdfUrl: null };
}

/** PDF を実際にダウンロードできるか検証（収集フィルタ用） */
export async function verifyPaperPdf(
  input: PdfResolveInput
): Promise<{ ok: boolean; pdfUrl: string | null }> {
  const { buffer, pdfUrl } = await downloadPdfForPaper(input);
  return { ok: Boolean(buffer), pdfUrl };
}
