import type { ArxivPaper } from "@/lib/arxiv";
import type { FetchTopic } from "@/lib/fetchTopics";

const RSS_BASE = "https://rss.arxiv.org/rss";

/** arXiv RSS のアーカイブ名（API 429 時のフォールバック） */
const TOPIC_RSS_ARCHIVES: Record<string, string[]> = {
  "agri-econ": ["econ", "q-fin"],
  "climate": ["physics", "econ"],
  "health": ["q-bio", "stat"],
  "development": ["econ"],
  "education": ["econ", "cs"],
  "labor": ["econ"],
  "trade": ["econ", "q-fin"],
  "energy": ["econ", "physics"],
  "urban": ["econ"],
  "behavior": ["econ"],
  "innovation": ["econ", "cs"],
  "food-system": ["q-bio", "econ"],
};

function stripXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? stripXml(m[1]) : "";
}

function extractAllTags(block: string, tag: string): string[] {
  return [...block.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) =>
    stripXml(m[1])
  );
}

function parseRssItem(itemXml: string): ArxivPaper | null {
  const link = extractTag(itemXml, "link");
  const title = extractTag(itemXml, "title");
  const description = extractTag(itemXml, "description");
  const categories = extractAllTags(itemXml, "category");
  const pubDate = extractTag(itemXml, "pubDate");
  /** RSS は dc:creator に著者がカンマ区切りで入る */
  const creatorRaw =
    extractTag(itemXml, "dc:creator") ||
    extractTag(itemXml, "creator") ||
    extractTag(itemXml, "author");
  const authors = creatorRaw
    .split(/[,;]+/)
    .map((s) => s.replace(/\s*\(.*?\)\s*/g, "").trim())
    .filter(Boolean);

  const idMatch = link.match(/arxiv\.org\/abs\/([^?#/]+)/i);
  if (!idMatch || !title) return null;

  const id = idMatch[1].replace(/v\d+$/i, "");
  const abstractMatch = description.match(/Abstract:\s*([\s\S]+)/i);
  const abstract = abstractMatch ? abstractMatch[1].trim() : description;

  if (!abstract || abstract.length < 40) return null;

  const mainCategory = categories[0] ?? "arxiv";
  return {
    id,
    title,
    abstract,
    authors,
    publishedAt: pubDate ? new Date(pubDate).toISOString() : "",
    url: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
    categories,
    journal: `arXiv（プレプリント / ${mainCategory}）`,
    source: "arxiv",
  };
}

function archivesForTopics(topics: FetchTopic[]): string[] {
  const archives = new Set<string>();
  for (const topic of topics) {
    for (const archive of TOPIC_RSS_ARCHIVES[topic.id] ?? ["econ"]) {
      archives.add(archive);
    }
  }
  return [...archives];
}

/**
 * arXiv RSS から新着を取得（export API の 429 時用。レート制限が緩い）
 */
export async function fetchArxivPapersFromRss(
  topics: FetchTopic[],
  maxPerArchive = 20
): Promise<ArxivPaper[]> {
  const archives = archivesForTopics(topics);
  const merged: ArxivPaper[] = [];
  const seen = new Set<string>();

  for (const archive of archives) {
    try {
      const res = await fetch(`${RSS_BASE}/${archive}`, {
        headers: { Accept: "application/rss+xml,*/*" },
      });
      if (!res.ok) {
        console.warn(`  arXiv RSS [${archive}]: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
      let count = 0;
      for (const itemXml of items) {
        if (count >= maxPerArchive) break;
        const paper = parseRssItem(itemXml);
        if (!paper || seen.has(paper.id)) continue;
        seen.add(paper.id);
        merged.push(paper);
        count += 1;
      }
      console.log(`  arXiv RSS [${archive}]: ${count}件`);
    } catch (error) {
      console.warn(`  arXiv RSS [${archive}] スキップ:`, error);
    }
  }

  return merged;
}
