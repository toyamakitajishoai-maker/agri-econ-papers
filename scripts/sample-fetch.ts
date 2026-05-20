import { fetchArxivPapersSince } from "@/lib/arxiv";
import { dedupeByArxivId, filterAgriculturePapers } from "@/lib/filter";

const TARGET_CATEGORIES = ["econ.GN", "econ.EM", "q-fin.EC"];
const ARXIV_FETCH_HOURS = 720;
const ARXIV_LOOKBACK_HOURS = [24, 72, 168, 336, 720];

async function main() {
  const now = new Date();
  const widestSince = new Date(now.getTime() - ARXIV_FETCH_HOURS * 60 * 60 * 1000);
  const arxivRawFull = await fetchArxivPapersSince(TARGET_CATEGORIES, widestSince, 100, now);

  let fetched = [];
  for (const hours of ARXIV_LOOKBACK_HOURS) {
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
    fetched = arxivRawFull.filter((paper) => {
      if (!paper.publishedAt) return false;
      return new Date(paper.publishedAt) >= since;
    });
    if (filterAgriculturePapers(fetched).length > 0) {
      console.log(`(lookback ${hours}h, in-memory)`);
      break;
    }
  }
  const filtered = filterAgriculturePapers(fetched);
  const deduped = dedupeByArxivId(filtered).slice(0, 15);

  console.log(`Fetched: ${fetched.length}`);
  console.log(`Filtered: ${filtered.length}`);
  console.log(`Selected: ${deduped.length}`);
  console.log("");

  for (const paper of deduped) {
    console.log(`- [${paper.id}] ${paper.title}`);
  }
}

main().catch((error) => {
  console.error("sample fetch failed:", error);
  process.exit(1);
});
