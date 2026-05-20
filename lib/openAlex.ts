import type { ArxivPaper } from "@/lib/arxiv";

const OPENALEX_BASE = "https://api.openalex.org";

/** OpenAlex の abstract_inverted_index を本文に戻す */
function decodeInvertedAbstract(inv: Record<string, number[]> | null | undefined): string {
  if (!inv || typeof inv !== "object") return "";
  const chunks: [number, string][] = [];
  for (const [word, positions] of Object.entries(inv)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      chunks.push([pos, word]);
    }
  }
  chunks.sort((a, b) => a[0] - b[0]);
  return chunks.map(([, w]) => w).join(" ").trim();
}

function normalizeDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^https?:\/\/doi\.org\//i, "");
  return s.length > 0 ? s : null;
}

type OpenAlexWork = {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_date?: string | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: Array<{ author?: { display_name?: string | null } | null }>;
  concepts?: Array<{ display_name?: string | null }>;
  primary_location?: {
    pdf_url?: string | null;
    landing_page_url?: string | null;
    raw_source_name?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
};

function workToPaper(work: OpenAlexWork): ArxivPaper | null {
  const rawId = work.id ?? "";
  const shortId = rawId.replace(/^https:\/\/openalex\.org\//i, "").trim();
  if (!shortId) return null;

  const title = (work.title ?? work.display_name ?? "").trim();
  if (!title) return null;

  const doi = normalizeDoi(work.doi ?? null);
  const abstract = decodeInvertedAbstract(work.abstract_inverted_index ?? undefined);
  const authors = (work.authorships ?? [])
    .map((a) => a.author?.display_name ?? "")
    .map((s) => s.trim())
    .filter(Boolean);

  const pub = work.publication_date?.trim();
  const publishedAt = pub ? `${pub}T12:00:00.000Z` : "";

  const conceptLabels = (work.concepts ?? [])
    .map((c) => c.display_name)
    .filter((x): x is string => Boolean(x))
    .slice(0, 4);

  const url = doi ? `https://doi.org/${doi}` : rawId;

  const pdfFromOpenAlex = work.primary_location?.pdf_url?.trim();
  const pdfUrl =
    pdfFromOpenAlex && /^https?:\/\//i.test(pdfFromOpenAlex) ? pdfFromOpenAlex : "";

  const journalFromSource = (work.primary_location?.source?.display_name ?? "").trim();
  const journalRaw = (work.primary_location?.raw_source_name ?? "").trim();
  const journal = journalFromSource || journalRaw || undefined;

  return {
    id: shortId,
    title,
    abstract,
    authors,
    publishedAt,
    url,
    pdfUrl,
    categories: ["openalex", ...conceptLabels],
    doi: doi ?? undefined,
    source: "openalex",
    journal,
  };
}

export type FetchOpenAlexOptions = {
  /** OpenAlex 推奨: User-Agent に mailto を含める */
  mailto: string;
  /** この日以降に公開された論文（YYYY-MM-DD、JST で渡す想定） */
  fromPublicationDate: string;
  /** 全文検索クエリ */
  searchQuery: string;
  perPage?: number;
};

/**
 * OpenAlex から新着論文を取得（無料API、キー不要）。
 * @see https://docs.openalex.org/
 */
export async function fetchOpenAlexRecentWorks(options: FetchOpenAlexOptions): Promise<ArxivPaper[]> {
  const perPage = Math.min(200, Math.max(5, options.perPage ?? 40));
  const url = new URL(`${OPENALEX_BASE}/works`);
  url.searchParams.set(
    "filter",
    `from_publication_date:${options.fromPublicationDate},has_doi:true,type:article`
  );
  url.searchParams.set("search", options.searchQuery);
  url.searchParams.set("sort", "publication_date:desc");
  url.searchParams.set("per_page", String(perPage));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": `mailto:${options.mailto}`,
    },
  });

  if (!res.ok) {
    throw new Error(`OpenAlex API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { results?: OpenAlexWork[] };
  const results = json.results ?? [];

  return results.map(workToPaper).filter((p): p is ArxivPaper => Boolean(p));
}
