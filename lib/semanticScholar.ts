import type { ArxivPaper } from "@/lib/arxiv";

type SemanticScholarPaper = {
  paperId?: string;
  title?: string;
  abstract?: string;
  url?: string;
  publicationDate?: string;
  publicationTypes?: string[];
  authors?: Array<{ name?: string }>;
  externalIds?: {
    ArXiv?: string;
  };
};

type SemanticScholarResponse = {
  data?: SemanticScholarPaper[];
};

function cleanArxivId(value: string): string {
  return value.replace(/^arXiv:/i, "").trim();
}

export async function fetchSemanticScholarArxivPapers(
  query = "agricultural economics",
  limit = 20
): Promise<ArxivPaper[]> {
  const endpoint = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("limit", String(limit));
  endpoint.searchParams.set(
    "fields",
    "title,abstract,url,publicationDate,authors,externalIds,publicationTypes"
  );

  const res = await fetch(endpoint.toString(), {
    headers: {
      "User-Agent": "agri-econ-papers/0.1",
    },
  });

  if (!res.ok) {
    throw new Error(`Semantic Scholar API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as SemanticScholarResponse;
  const papers = json.data ?? [];

  return papers
    .filter((paper) => Boolean(paper.externalIds?.ArXiv))
    .map((paper) => {
      const id = cleanArxivId(paper.externalIds?.ArXiv ?? "");
      return {
        id,
        title: paper.title ?? "",
        abstract: paper.abstract ?? "",
        authors: (paper.authors ?? []).map((author) => author.name ?? "").filter(Boolean),
        publishedAt: paper.publicationDate ?? "",
        url: `https://arxiv.org/abs/${id}`,
        pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
        categories: paper.publicationTypes ?? ["semantic-scholar"],
      };
    })
    .filter((paper) => paper.id && paper.title && paper.abstract);
}
