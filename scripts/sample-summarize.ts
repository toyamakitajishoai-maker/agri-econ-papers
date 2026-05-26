import { fetchArxivPapersSince, type ArxivPaper } from "@/lib/arxiv";
import { dedupeByArxivId, filterAgriculturePapers } from "@/lib/filter";
import { summarizePapersWithGemini } from "@/lib/gemini";

const TARGET_CATEGORIES = ["econ.GN", "econ.EM", "q-fin.EC"];
const ARXIV_FETCH_HOURS = 720;
const ARXIV_LOOKBACK_HOURS = [24, 72, 168, 336, 720];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const now = new Date();
  const widestSince = new Date(now.getTime() - ARXIV_FETCH_HOURS * 60 * 60 * 1000);
  const arxivRawFull = await fetchArxivPapersSince(TARGET_CATEGORIES, widestSince, 100, now);

  let fetched: ArxivPaper[] = [];
  for (const hours of ARXIV_LOOKBACK_HOURS) {
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
    fetched = arxivRawFull.filter((paper) => {
      if (!paper.publishedAt) return false;
      return new Date(paper.publishedAt) >= since;
    });
    if (filterAgriculturePapers(fetched).length > 0) {
      break;
    }
  }
  const selected = dedupeByArxivId(filterAgriculturePapers(fetched)).slice(0, 2);

  if (selected.length === 0) {
    console.log("No target papers found in lookback window.");
    return;
  }

  const summarized = await summarizePapersWithGemini(selected, apiKey);
  for (const paper of summarized) {
    console.log(`\n[${paper.id}] ${paper.title}`);
    console.log(`要点: ${paper.summary.gist}`);
    console.log(`結果: ${paper.summary.results.slice(0, 120)}...`);
  }
}

main().catch((error) => {
  console.error("sample summarize failed:", error);
  process.exit(1);
});
