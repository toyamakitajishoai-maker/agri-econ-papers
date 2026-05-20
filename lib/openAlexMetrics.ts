/** OpenAlex から引用数・出版年・ジャーナル情報を取得（無料API） */

function normalizeDoi(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^https?:\/\/doi\.org\//i, "");
  return s.length > 0 ? s : null;
}

function sourceShortIdFromOpenAlexUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/S\d+$/i);
  return m ? m[0].toUpperCase() : null;
}

export type OpenAlexWorkMetrics = {
  citedByCount: number | null;
  publicationYear: number | null;
  /** 掲載誌名（ワークの primary_location） */
  journalName: string | null;
  /** ジャーナル詳細API用の短いID（例: S2597028195） */
  sourceShortId: string | null;
};

export type OpenAlexSourceJournalMetrics = {
  /** ジャーナル全体の2年平均被引用（OpenAlex。JCRのIFとは別物） */
  twoYearMeanCitedness: number | null;
  hIndex: number | null;
};

/**
 * ジャーナル（ソース）の要約統計。同一ソースはエクスポート側でキャッシュ推奨。
 */
export async function fetchOpenAlexSourceJournalMetrics(opts: {
  sourceShortId: string;
  mailto: string;
}): Promise<OpenAlexSourceJournalMetrics> {
  const id = opts.sourceShortId.trim();
  if (!/^S\d+$/i.test(id)) {
    return { twoYearMeanCitedness: null, hIndex: null };
  }

  const url = `https://api.openalex.org/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `mailto:${opts.mailto}`,
    },
  });

  if (!res.ok) {
    return { twoYearMeanCitedness: null, hIndex: null };
  }

  const json = (await res.json()) as {
    summary_stats?: {
      "2yr_mean_citedness"?: number;
      h_index?: number;
    } | null;
  };

  const stats = json.summary_stats;
  const twoYr =
    stats && typeof stats["2yr_mean_citedness"] === "number" ? stats["2yr_mean_citedness"] : null;
  const hIdx = stats && typeof stats.h_index === "number" ? stats.h_index : null;

  return { twoYearMeanCitedness: twoYr, hIndex: hIdx };
}

/**
 * @param mailto OpenAlex 推奨の連絡先（User-Agent）
 */
export async function fetchOpenAlexWorkMetrics(opts: {
  doi?: string;
  openAlexWorkId?: string;
  mailto: string;
}): Promise<OpenAlexWorkMetrics> {
  const doi = normalizeDoi(opts.doi);
  const id = opts.openAlexWorkId?.trim();

  let url: string | null = null;
  if (doi) {
    url = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`;
  } else if (id && /^W\d+$/i.test(id)) {
    url = `https://api.openalex.org/${encodeURIComponent(id)}`;
  }

  if (!url) {
    return {
      citedByCount: null,
      publicationYear: null,
      journalName: null,
      sourceShortId: null,
    };
  }

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `mailto:${opts.mailto}`,
    },
  });

  if (!res.ok) {
    return {
      citedByCount: null,
      publicationYear: null,
      journalName: null,
      sourceShortId: null,
    };
  }

  const json = (await res.json()) as {
    cited_by_count?: number;
    publication_year?: number;
    primary_location?: {
      source?: { id?: string | null; display_name?: string | null } | null;
      raw_source_name?: string | null;
    } | null;
  };

  const cited = typeof json.cited_by_count === "number" ? json.cited_by_count : null;
  const year = typeof json.publication_year === "number" ? json.publication_year : null;

  const nameFromSource = (json.primary_location?.source?.display_name ?? "").trim();
  const nameRaw = (json.primary_location?.raw_source_name ?? "").trim();
  const journalName = nameFromSource || nameRaw || null;
  const sourceShortId = sourceShortIdFromOpenAlexUrl(json.primary_location?.source?.id ?? null);

  return { citedByCount: cited, publicationYear: year, journalName, sourceShortId };
}
