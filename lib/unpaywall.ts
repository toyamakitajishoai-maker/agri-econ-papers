/**
 * DOI から「合法的に無料で読めるPDF」のURLを調べる（Unpaywall API）。
 * 出版社サイトのスクレイピングはせず、オープンアクセスのメタデータのみ利用する。
 * @see https://unpaywall.org/products/api
 */

type UnpaywallResponse = {
  is_oa?: boolean;
  best_oa_location?: {
    url_for_pdf?: string | null;
    url?: string | null;
  } | null;
};

/**
 * @returns PDF直リンク（あれば）。無ければ null。
 */
export async function lookupOpenAccessPdfUrl(doi: string, email: string): Promise<string | null> {
  const clean = doi.replace(/^https?:\/\/doi\.org\//i, "").trim();
  if (!clean || !email.trim()) return null;

  const endpoint = `https://api.unpaywall.org/v2/${encodeURIComponent(clean)}?email=${encodeURIComponent(email.trim())}`;

  const res = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": `mailto:${email.trim()}`,
    },
  });

  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) {
    console.warn(`Unpaywall: ${res.status} for DOI ${clean}`);
    return null;
  }

  const data = (await res.json()) as UnpaywallResponse;
  if (!data.is_oa || !data.best_oa_location) return null;

  const pdf = data.best_oa_location.url_for_pdf ?? data.best_oa_location.url;
  if (pdf && /^https?:\/\//i.test(pdf)) {
    return pdf;
  }
  return null;
}
