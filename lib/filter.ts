export const AGRI_KEYWORDS = [
  "agricultur",
  "agricultural",
  "agriculture",
  "farm",
  "farming",
  "food security",
  "food system",
  "crop",
  "rural",
  "land use",
  "soil",
  "irrigation",
  "livestock",
  "subsidy",
  "common agricultural policy",
];

export type KeywordScannable = {
  title: string;
  abstract: string;
  authors: string[];
};

function includesAnyKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export function filterAgriculturePapers<T extends KeywordScannable>(
  papers: T[],
  keywords: string[] = AGRI_KEYWORDS
): T[] {
  return papers.filter((paper) => {
    const combinedText = `${paper.title}\n${paper.abstract}\n${paper.authors.join(" ")}`;
    return includesAnyKeyword(combinedText, keywords);
  });
}

export function dedupeByArxivId<T extends { id: string }>(papers: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const paper of papers) {
    if (seen.has(paper.id)) {
      continue;
    }
    seen.add(paper.id);
    result.push(paper);
  }

  return result;
}
