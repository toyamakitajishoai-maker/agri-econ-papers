/** 収集用：分野ごとの検索クエリ（OpenAlex / Semantic Scholar）と arXiv カテゴリ */
export type FetchTopic = {
  id: string;
  labelJa: string;
  openAlexQuery: string;
  semanticQuery: string;
  arxivCategories: string[];
  /**
   * ランダム選択時の重み（高いほど選ばれやすい）。
   * 既定は 1。「分野が偏らないようにしたい」目的のため、
   * もともと多めに来ていた農業経済・食料システムは下げ、
   * 新しいキャッチーな分野は同じか少し高めにしている。
   */
  weight?: number;
};

export const FETCH_TOPICS: FetchTopic[] = [
  // ─── 経済・社会系（既存 + 重み調整） ─────────────────────────────
  {
    id: "agri-econ",
    labelJa: "農業経済",
    openAlexQuery: "agricultural economics food security rural development",
    semanticQuery: "agricultural economics",
    arxivCategories: ["econ.AG", "econ.GN", "q-fin.EC"],
    weight: 1.2,
  },
  {
    id: "food-system",
    labelJa: "食料システム",
    openAlexQuery: "food systems supply chain food waste nutrition",
    semanticQuery: "food systems research",
    arxivCategories: ["q-bio.PE", "econ.GN"],
    weight: 0.5,
  },
  {
    id: "climate",
    labelJa: "気候・環境",
    openAlexQuery: "climate change adaptation environmental policy carbon",
    semanticQuery: "climate change policy",
    arxivCategories: ["physics.ao-ph", "q-fin.EC"],
  },
  {
    id: "development",
    labelJa: "開発経済",
    openAlexQuery: "economic development poverty inequality emerging economies",
    semanticQuery: "development economics",
    arxivCategories: ["econ.GN", "econ.TH"],
    weight: 0.7,
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
    weight: 1.3,
  },
  {
    id: "innovation",
    labelJa: "イノベーション・技術",
    openAlexQuery: "innovation technology adoption productivity R&D",
    semanticQuery: "innovation economics",
    arxivCategories: ["econ.GN", "cs.CY"],
  },
  {
    id: "finance",
    labelJa: "ファイナンス・保険",
    openAlexQuery: "finance insurance risk portfolio asset pricing",
    semanticQuery: "quantitative finance",
    arxivCategories: ["q-fin.RM", "q-fin.PM", "q-fin.ST", "q-fin.CP", "q-fin.PR", "q-fin.TR", "q-fin.MF"],
  },
  {
    id: "ai-tech",
    labelJa: "AI・データサイエンス",
    openAlexQuery: "artificial intelligence machine learning deep learning large language model",
    semanticQuery: "machine learning artificial intelligence",
    arxivCategories: ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"],
  },
  {
    id: "humanities",
    labelJa: "歴史・人文・社会",
    openAlexQuery: "history humanities cultural network social structure",
    semanticQuery: "digital humanities history",
    arxivCategories: ["physics.soc-ph", "cs.SI"],
  },
  {
    id: "policy",
    labelJa: "公共政策・ガバナンス",
    openAlexQuery: "public policy governance regulation institution",
    semanticQuery: "public policy governance",
    arxivCategories: ["econ.GN", "cs.CY"],
  },

  // ─── 生命科学・自然科学系（新規追加：キャッチーな話題） ───────
  {
    id: "biology",
    labelJa: "生命科学・進化",
    openAlexQuery:
      "evolutionary biology ecology animal behavior population biology",
    semanticQuery: "evolutionary biology ecology",
    arxivCategories: ["q-bio.PE", "q-bio.MN"],
    weight: 1.4,
  },
  {
    id: "genomics",
    labelJa: "遺伝・ゲノム",
    openAlexQuery:
      "genetics genomics DNA sequencing CRISPR molecular biology",
    semanticQuery: "genomics genetics",
    arxivCategories: ["q-bio.GN", "q-bio.MN"],
    weight: 1.2,
  },
  {
    id: "agronomy",
    labelJa: "農学・作物科学",
    openAlexQuery:
      "crop science plant breeding agronomy soil microbiome plant pathology",
    semanticQuery: "crop science plant biology",
    arxivCategories: ["q-bio.PE", "q-bio.QM"],
    weight: 1.3,
  },
  {
    id: "neuroscience",
    labelJa: "神経・脳科学",
    openAlexQuery:
      "neuroscience brain cognition neural representation memory",
    semanticQuery: "cognitive neuroscience",
    arxivCategories: ["q-bio.NC"],
    weight: 1.2,
  },
  {
    id: "health",
    labelJa: "医学・健康",
    openAlexQuery:
      "public health medicine epidemiology nutrition intervention clinical",
    semanticQuery: "public health medicine",
    arxivCategories: ["q-bio.QM", "stat.AP"],
    weight: 1.2,
  },
  {
    id: "astro",
    labelJa: "天文・宇宙",
    openAlexQuery:
      "astrophysics cosmology exoplanet dark matter galaxy formation",
    semanticQuery: "astrophysics cosmology",
    arxivCategories: ["astro-ph.CO", "astro-ph.EP", "astro-ph.GA", "astro-ph.SR"],
    weight: 1.1,
  },
];

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * 重複なしで重み付きランダムに分野を選ぶ（日次 fetch 用）。
 * weight が大きいほど早めに選ばれる。
 */
export function pickRandomTopics(count: number): FetchTopic[] {
  const n = Math.min(Math.max(1, count), FETCH_TOPICS.length);
  const pool = FETCH_TOPICS.map((t) => ({ topic: t, weight: t.weight ?? 1 }));
  const picked: FetchTopic[] = [];
  while (picked.length < n && pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i += 1) {
      r -= pool[i].weight;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picked.push(pool[idx].topic);
    pool.splice(idx, 1);
  }
  return picked;
}

const MANDATORY_SMART_TOPIC_IDS = ["agri-econ", "food-system"] as const;

export function topicById(id: string): FetchTopic | undefined {
  return FETCH_TOPICS.find((t) => t.id === id);
}

/**
 * 日次 fetch 用。スマート選出 ON のときは農業経済・食料システムを必ず含め、
 * ローカルと GitHub Actions で同じ方針の候補プールを作る。
 */
export function pickTopicsForDailyFetch(
  count: number,
  options?: { smartSelection?: boolean }
): FetchTopic[] {
  const n = Math.min(Math.max(1, count), FETCH_TOPICS.length);
  if (!options?.smartSelection) {
    return pickRandomTopics(n);
  }

  const mandatory = MANDATORY_SMART_TOPIC_IDS.map((id) => topicById(id)).filter(
    (t): t is FetchTopic => Boolean(t)
  );
  const remaining = n - mandatory.length;
  if (remaining <= 0) {
    return mandatory.slice(0, n);
  }

  const excludeIds = new Set(mandatory.map((t) => t.id));
  const extraFiltered = pickRandomTopics(remaining).filter((t) => !excludeIds.has(t.id));
  const merged = [...mandatory, ...extraFiltered];
  const seen = new Set<string>();
  return merged.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/** OpenAlex / arXiv で農経系を必ず叩くための追加トピック（本日のランダム分野に加える） */
export function getMandatoryOpenAlexTopics(smartSelection: boolean): FetchTopic[] {
  if (!smartSelection) return [];
  return MANDATORY_SMART_TOPIC_IDS.map((id) => topicById(id)).filter((t): t is FetchTopic =>
    Boolean(t)
  );
}

/** スマート選出時は本日の topics の先頭（農経・食料が必ず入る）から arXiv を取る */
export function pickArxivTopicsForFetch(
  dailyTopics: FetchTopic[],
  smartSelection: boolean
): FetchTopic[] {
  const n = Math.min(4, dailyTopics.length);
  if (smartSelection) {
    return dailyTopics.slice(0, n);
  }
  return pickRandomTopics(n);
}

/** OpenAlex ループ用：必須分野 + 本日分野の重複除去 */
export function mergeOpenAlexTopics(
  dailyTopics: FetchTopic[],
  smartSelection: boolean
): FetchTopic[] {
  const mandatory = getMandatoryOpenAlexTopics(smartSelection);
  const seen = new Set<string>();
  return [...mandatory, ...dailyTopics].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
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
