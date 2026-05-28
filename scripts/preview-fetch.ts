/**
 * 明日のフェッチ前に、新規追加分野（生物・農学・ゲノム・医学・宇宙）が
 * ちゃんと論文を引いてこられるか確認するためのドライラン。
 * data/ には何も書き込まない。
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { fetchArxivPapersSince } from "@/lib/arxiv";
import { fetchOpenAlexRecentWorks } from "@/lib/openAlex";
import { FETCH_TOPICS, pickRandomTopics } from "@/lib/fetchTopics";

const OPENALEX_LOOKBACK_DAYS = 90;
const ARXIV_LOOKBACK_DAYS = 7;
const PER_TOPIC = 5;

/** 確認したい新規分野 */
const PREVIEW_IDS = ["biology", "genomics", "agronomy", "health", "astro"];

function jstDateMinusDays(days: number): string {
  const now = new Date();
  const jst = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(jst);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const mailto = (process.env.OPENALEX_MAILTO ?? process.env.UNPAYWALL_EMAIL ?? "").trim();
  if (!mailto) {
    console.warn("OPENALEX_MAILTO がありません。OpenAlex は不安定になります。");
  }

  const targets = FETCH_TOPICS.filter((t) => PREVIEW_IDS.includes(t.id));
  console.log(`=== 新規分野プレビュー (${targets.length}件) ===\n`);

  const fromDate = jstDateMinusDays(OPENALEX_LOOKBACK_DAYS);

  for (const topic of targets) {
    console.log(`\n──────── ${topic.labelJa} (${topic.id}) ────────`);
    console.log(`  OpenAlex query: "${topic.openAlexQuery}"`);
    console.log(`  arXiv categories: [${topic.arxivCategories.join(", ")}]\n`);

    if (mailto) {
      try {
        const oa = await fetchOpenAlexRecentWorks({
          mailto,
          fromPublicationDate: fromDate,
          searchQuery: topic.openAlexQuery,
          perPage: PER_TOPIC,
        });
        console.log(`  ▼ OpenAlex (過去${OPENALEX_LOOKBACK_DAYS}日) ${oa.length}件:`);
        oa.slice(0, PER_TOPIC).forEach((p, i) => {
          const date = (p.publishedAt ?? "").slice(0, 10);
          const title = p.title.length > 80 ? `${p.title.slice(0, 80)}…` : p.title;
          console.log(`    ${i + 1}. [${date}] ${title}`);
          console.log(`       ${p.journal ?? ""}`);
        });
        if (oa.length === 0) console.log("    (該当なし)");
      } catch (e) {
        console.warn(`  OpenAlex エラー: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(500);
    }

    try {
      const since = new Date(Date.now() - ARXIV_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      const arx = await fetchArxivPapersSince(topic.arxivCategories, since, PER_TOPIC * 2);
      console.log(`  ▼ arXiv (過去${ARXIV_LOOKBACK_DAYS}日) ${arx.length}件:`);
      arx.slice(0, PER_TOPIC).forEach((p, i) => {
        const date = (p.publishedAt ?? "").slice(0, 10);
        const title = p.title.length > 80 ? `${p.title.slice(0, 80)}…` : p.title;
        console.log(`    ${i + 1}. [${date}] ${title}`);
      });
      if (arx.length === 0) console.log("    (該当なし)");
    } catch (e) {
      console.warn(`  arXiv エラー: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(500);
  }

  console.log("\n=== ランダム重み付き抽選デモ (5回) ===");
  for (let i = 0; i < 5; i += 1) {
    const picks = pickRandomTopics(6).map((t) => t.labelJa);
    console.log(`  ${i + 1}. ${picks.join(" / ")}`);
  }

  console.log("\n=== 完了。データには何も保存していません ===");
}

main().catch((e) => {
  console.error("preview-fetch failed:", e);
  process.exit(1);
});
