import type { CategoryL1, Paper } from "@/lib/types";

/** arXiv primary / 細分類 → 1日5本枠の大分類 */
export const CATEGORY_MAP: Record<string, CategoryL1> = {
  "econ.AG": "agri-econ",
  "q-fin.AGR": "agri-econ",
  "econ.GN": "adjacent",
  "econ.EM": "adjacent",
  "econ.TH": "adjacent",
  "econ.LM": "adjacent",
  "econ.IT": "adjacent",
  "q-fin.RM": "adjacent",
  "q-fin.EC": "adjacent",
  "q-fin.PM": "adjacent",
  "q-fin.ST": "adjacent",
  "q-fin.GN": "adjacent",
  "stat.AP": "adjacent",
  "stat.ME": "adjacent",
  "cs.LG": "serendipity",
  "cs.AI": "serendipity",
  "cs.CL": "serendipity",
  "cs.CV": "serendipity",
  "stat.ML": "serendipity",
  "physics.soc-ph": "serendipity",
  "q-bio.QM": "adjacent",
  "q-bio.PE": "agri-econ",
};

const AGRI_KEYWORDS =
  /\b(agricultur|farm|farming|crop|livestock|food security|agri|農業|農家|作物|畜産|食料|農地|アグリ|土壌|収穫|灌漑)\b/i;

const SERENDIPITY_PREFIXES = new Set([
  "cs",
  "stat.ML",
  "astro",
  "gr",
  "hep",
  "cond-mat",
  "math",
]);

export const SLOT_LABELS: Record<CategoryL1, { emoji: string; label: string }> = {
  "agri-econ": { emoji: "🌾", label: "コア農経" },
  adjacent: { emoji: "🌱", label: "隣接分野" },
  serendipity: { emoji: "🎲", label: "セレンディピティ" },
};

/** category_l2 の画面表示名 */
export const CATEGORY_L2_LABELS: Record<string, string> = {
  "farm-management": "生産・農家経営",
  "market-price": "市場・価格・流通",
  "policy-institution": "政策・制度",
  "climate-sustainability": "気候・サステナ",
  development: "開発・途上国",
  "agri-ai": "フードテック・農業AI",
  "consumer-behavior": "消費・行動経済",
  "methods-import": "手法・データ",
  "risk-management": "リスク管理",
  "general-econ": "経済全般",
};

export function categoryL2Label(code: string | undefined): string | null {
  if (!code?.trim()) return null;
  return CATEGORY_L2_LABELS[code] ?? null;
}

export type ClassifyResult = {
  categoryL1: CategoryL1;
  categoryL2: string;
  arxivPrimary: string;
  agriRelevanceScore: number;
};

function firstArxivCategory(categories: string[]): string {
  for (const raw of categories) {
    const c = raw.trim();
    if (!c || c.startsWith("topic:")) continue;
    if (/^[a-z\-]+\.[a-z\-A-Z]+$/i.test(c)) return c;
  }
  return "";
}

function mapCategoryCode(code: string): CategoryL1 | null {
  if (CATEGORY_MAP[code]) return CATEGORY_MAP[code];
  const prefix = code.split(".")[0]?.toLowerCase();
  if (prefix && SERENDIPITY_PREFIXES.has(prefix)) return "serendipity";
  if (prefix === "econ" || prefix === "q-fin") return "adjacent";
  if (prefix === "q-bio") return "adjacent";
  return null;
}

/** abstract 中の農経キーワード密度（0〜1） */
export function agriRelevanceScore(abstract: string, title = ""): number {
  const text = `${title} ${abstract}`.toLowerCase();
  const hits = (text.match(AGRI_KEYWORDS) ?? []).length;
  if (hits === 0) return 0;
  return Math.min(1, hits / 4);
}

function inferCategoryL2(
  slot: CategoryL1,
  categories: string[],
  field?: string,
  abstract?: string
): string {
  const topic = categories.find((c) => c.startsWith("topic:"))?.replace(/^topic:/, "");
  const topicMap: Record<string, string> = {
    "agri-econ": "farm-management",
    "food-system": "market-price",
    agronomy: "farm-management",
    climate: "climate-sustainability",
    development: "development",
    behavior: "consumer-behavior",
    "ai-tech": "agri-ai",
    finance: "market-price",
    policy: "policy-institution",
    trade: "market-price",
    labor: "farm-management",
    energy: "climate-sustainability",
    urban: "development",
    health: "consumer-behavior",
  };
  if (topic && topicMap[topic]) return topicMap[topic];

  const text = `${field ?? ""} ${abstract ?? ""}`;
  if (/気候|環境|カーボン|持続/.test(text)) return "climate-sustainability";
  if (/市場|価格|流通|サプライ/.test(text)) return "market-price";
  if (/政策|制度|規制|補助/.test(text)) return "policy-institution";
  if (/消費|行動|実験/.test(text)) return "consumer-behavior";
  if (/AI|機械学習|リモセン|データ/.test(text)) return "agri-ai";
  if (/途上|開発|貧困|農村/.test(text)) return "development";
  if (slot === "agri-econ") return "farm-management";
  if (slot === "serendipity") return "methods-import";
  return "general-econ";
}

/**
 * arXiv カテゴリ + キーワードで category_l1 / category_l2 を判定。
 * stat.AP 等でも abstract に農業語があれば agri-econ に昇格。
 */
export function classifyPaper(input: {
  categories: string[];
  abstract?: string;
  title?: string;
  field?: string;
}): ClassifyResult {
  const arxivPrimary = firstArxivCategory(input.categories);
  let slot: CategoryL1 = mapCategoryCode(arxivPrimary) ?? "adjacent";

  const agriScore = agriRelevanceScore(input.abstract ?? "", input.title ?? "");
  if (agriScore >= 0.35) slot = "agri-econ";
  else if (agriScore >= 0.15 && slot === "adjacent") slot = "agri-econ";

  if (
    slot === "adjacent" &&
    arxivPrimary &&
    SERENDIPITY_PREFIXES.has(arxivPrimary.split(".")[0] ?? "")
  ) {
    slot = "serendipity";
  }

  for (const raw of input.categories) {
    const mapped = mapCategoryCode(raw.trim());
    if (mapped === "agri-econ") {
      slot = "agri-econ";
      break;
    }
  }

  const topicAgri = input.categories.some((c) =>
    ["topic:agri-econ", "topic:food-system", "topic:agronomy"].includes(c)
  );
  if (topicAgri) slot = "agri-econ";

  return {
    categoryL1: slot,
    categoryL2: inferCategoryL2(slot, input.categories, input.field, input.abstract),
    arxivPrimary: arxivPrimary || "unknown",
    agriRelevanceScore: agriScore,
  };
}

export function classifyFromPaper(paper: Paper): ClassifyResult {
  return classifyPaper({
    categories: paper.categories,
    abstract: paper.abstract,
    title: paper.title,
    field: paper.field,
  });
}

/** 旧データの econ/cs 等を無視して再分類 */
export function resolvePaperSlot(paper: Paper): ClassifyResult {
  const valid: CategoryL1[] = ["agri-econ", "adjacent", "serendipity"];
  if (paper.categoryL1 && valid.includes(paper.categoryL1)) {
    return {
      categoryL1: paper.categoryL1,
      categoryL2: paper.categoryL2 ?? inferCategoryL2(paper.categoryL1, paper.categories, paper.field, paper.abstract),
      arxivPrimary: paper.arxivPrimary ?? firstArxivCategory(paper.categories),
      agriRelevanceScore: agriRelevanceScore(paper.abstract, paper.title),
    };
  }
  return classifyFromPaper(paper);
}
