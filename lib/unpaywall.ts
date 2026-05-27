/**
 * DOI から「合法的に無料で読めるPDF」のURLを調べる（Unpaywall API）。
 * 出版社サイトのスクレイピングはせず、オープンアクセスのメタデータのみ利用する。
 * @see https://unpaywall.org/products/api
 */

type OaLocation = {
  url_for_pdf?: string | null;
  url?: string | null;
  host_type?: string | null;
};

type UnpaywallResponse = {
  is_oa?: boolean;
  best_oa_location?: OaLocation | null;
  oa_locations?: OaLocation[] | null;
};

function locationUrls(loc: OaLocation): string[] {
  const urls: string[] = [];
  const pdf = loc.url_for_pdf?.trim();
  const page = loc.url?.trim();
  if (pdf && /^https?:\/\//i.test(pdf)) urls.push(pdf);
  if (page && /^https?:\/\//i.test(page)) urls.push(page);
  return urls;
}

/**
 * @returns PDF直リンク候補（強い順）。無ければ空配列。
 */
export async function lookupOpenAccessPdfUrls(doi: string, email: string): Promise<string[]> {
  const clean = doi.replace(/^https?:\/\/doi\.org\//i, "").trim();
  if (!clean || !email.trim()) return [];

  const endpoint = `https://api.unpaywall.org/v2/${encodeURIComponent(clean)}?email=${encodeURIComponent(email.trim())}`;

  const res = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": `mailto:${email.trim()}`,
    },
  });

  if (res.status === 404 || res.status === 422) return [];
  if (!res.ok) {
    console.warn(`Unpaywall: ${res.status} for DOI ${clean}`);
    return [];
  }

  const data = (await res.json()) as UnpaywallResponse;
  if (!data.is_oa) return [];

  const locations: OaLocation[] = [];
  if (data.best_oa_location) locations.push(data.best_oa_location);
  for (const loc of data.oa_locations ?? []) {
    locations.push(loc);
  }

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const loc of locations) {
    for (const u of locationUrls(loc)) {
      if (!seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    }
  }
  return urls;
}

/**
 * @returns PDF直リンク（あれば）。無ければ null。
 * @deprecated 複数候補は lookupOpenAccessPdfUrls を使用
 */
export async function lookupOpenAccessPdfUrl(doi: string, email: string): Promise<string | null> {
  const urls = await lookupOpenAccessPdfUrls(doi, email);
  return urls[0] ?? null;
}
