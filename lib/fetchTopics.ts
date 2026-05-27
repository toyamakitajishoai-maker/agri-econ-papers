/** 収集用：分野ごとの検索クエリ（OpenAlex / Semantic Scholar）と arXiv カテゴリ */
export type FetchTopic = {
  id: string;
  labelJa: string;
  openAlexQuery: string;
  semanticQuery: string;
  arxivCategories: string[];
};

export const FETCH_TOPICS: FetchTopic[] = [
  {
    id: "agri-econ",
    labelJa: "農業経済",
    openAlexQuery: "agricultural economics food security rural development",
    semanticQuery: "agricultural economics",
    arxivCategories: ["econ.GN", "q-fin.EC"],
  },
  {
    id: "climate",
    labelJa: "気候・環境",
    openAlexQuery: "climate change adaptation environmental policy carbon",
    semanticQuery: "climate change policy",
    arxivCategories: ["physics.ao-ph", "q-fin.EC"],
  },
  {
    id: "health",
    labelJa: "健康・公衆衛生",
    openAlexQuery: "public health epidemiology nutrition intervention",
    semanticQuery: "public health research",
    arxivCategories: ["q-bio.QM", "stat.AP"],
  },
  {
    id: "development",
    labelJa: "開発経済",
    openAlexQuery: "economic development poverty inequality emerging economies",
    semanticQuery: "development economics",
    arxivCategories: ["econ.GN", "econ.TH"],
  },
  {
    id: "education",
    labelJa: "教育",
    openAlexQuery: "education policy learning outcomes school",
    semanticQuery: "education research",
    arxivCategories: ["econ.GN", "cs.CY"],
  },
  {
    id: "labor",
    labelJa: "労働・雇用",
    openAlexQuery: "labor market employment wages migration",
    semanticQuery: "labor economics",
    arxivCategories: ["econ.GN", "econ.LM"],
  },
  {
    id: "trade",
    labelJa: "貿易・国際経済",
    openAlexQuery: "international trade globalization supply chain",
    semanticQuery: "international trade",
    arxivCategories: ["econ.GN", "econ.IT"],
  },
  {
    id: "energy",
    labelJa: "エネルギー",
    openAlexQuery: "renewable energy policy electricity markets",
    semanticQuery: "energy economics",
    arxivCategories: ["econ.GN", "physics.soc-ph"],
  },
  {
    id: "urban",
    labelJa: "都市・地域",
    openAlexQuery: "urban economics housing regional development",
    semanticQuery: "urban economics",
    arxivCategories: ["econ.GN", "physics.soc-ph"],
  },
  {
    id: "behavior",
    labelJa: "行動・心理",
    openAlexQuery: "behavioral economics psychology decision making experiment",
    semanticQuery: "behavioral economics",
    arxivCategories: ["econ.GN", "q-fin.EC"],
  },
  {
    id: "innovation",
    labelJa: "イノベーション・技術",
    openAlexQuery: "innovation technology adoption productivity R&D",
    semanticQuery: "innovation economics",
    arxivCategories: ["econ.GN", "cs.CY"],
  },
  {
    id: "food-system",
    labelJa: "食料システム",
    openAlexQuery: "food systems supply chain food waste nutrition",
    semanticQuery: "food systems research",
    arxivCategories: ["q-bio.PE", "econ.GN"],
  },
];

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** 重複なしでランダムに分野を選ぶ（日次 fetch 用） */
export function pickRandomTopics(count: number): FetchTopic[] {
  const n = Math.min(Math.max(1, count), FETCH_TOPICS.length);
  return shuffleInPlace([...FETCH_TOPICS]).slice(0, n);
}

/** 複数分野の arXiv カテゴリを1クエリにまとめる（API呼び出し回数削減） */
export function mergeArxivCategories(topics: FetchTopic[]): string[] {
  return [...new Set(topics.flatMap((t) => t.arxivCategories))];
}

/** 論文のカテゴリから分野ラベルを推定 */
export function inferTopicForPaper(paper: { categories: string[] }, topics: FetchTopic[]): FetchTopic {
  for (const topic of topics) {
    if (paper.categories.some((c) => topic.arxivCategories.includes(c))) {
      return topic;
    }
  }
  return topics[0];
}
