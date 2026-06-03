import {
  CATEGORY_MAP,
  SLOT_LABELS,
  classifyPaper,
  classifyFromPaper,
  resolvePaperSlot,
} from "@/lib/classifyPaper";
import { CATEGORY_L1_LABELS, inferCategoryL1, inferCategoryL2 } from "@/lib/categoryL1";
import { FETCH_TOPICS } from "@/lib/fetchTopics";
import type { CategoryL1 } from "@/lib/types";

export {
  CATEGORY_MAP,
  SLOT_LABELS,
  classifyPaper,
  classifyFromPaper,
  resolvePaperSlot,
  CATEGORY_L1_LABELS,
  inferCategoryL1,
  inferCategoryL2,
};
export type { CategoryL1 };

/**
 * arXiv カテゴリ・OpenAlex 概念 → 日本語タグの単一ソース。
 *
 * 方針:
 * - 大分類（field）と中分類（具体カテゴリ）の2レイヤー
 * - 表示時は field を1個目、次に中分類を最大 2〜3 個
 * - ノイズ（NLPで誤抽出されがちな同名異義語）は EXCLUDE で弾く
 * - slug は URL に安全な英数字のみ（タグページ /tags/[slug] のキー）
 */

/** arXiv 公式カテゴリ → 日本語タグ */
export const ARXIV_CATEGORY_MAP: Record<string, string> = {
  // Computer Science
  "cs.AI": "AI・機械学習",
  "cs.LG": "AI・機械学習",
  "cs.CL": "自然言語処理",
  "cs.CV": "コンピュータビジョン",
  "cs.CR": "セキュリティ",
  "cs.CY": "コンピュータと社会",
  "cs.GT": "ゲーム理論",
  "cs.HC": "ヒューマンインタフェース",
  "cs.IR": "情報検索",
  "cs.NE": "ニューラル計算",
  "cs.RO": "ロボティクス",
  "cs.SE": "ソフトウェア工学",
  "cs.DB": "データベース",
  "cs.DC": "分散・並列計算",
  "cs.MA": "マルチエージェント",
  // Economics
  "econ.GN": "経済学",
  "econ.TH": "経済理論",
  "econ.EM": "計量経済学",
  "econ.LM": "労働経済学",
  "econ.IT": "国際貿易",
  // Quantitative Finance
  "q-fin.PM": "ポートフォリオ管理",
  "q-fin.RM": "リスク管理",
  "q-fin.ST": "金融統計",
  "q-fin.CP": "計算ファイナンス",
  "q-fin.EC": "金融経済",
  "q-fin.GN": "金融全般",
  "q-fin.MF": "数理ファイナンス",
  "q-fin.PR": "価格付け",
  "q-fin.TR": "トレーディング",
  // Quantitative Biology
  "q-bio.NC": "神経科学",
  "q-bio.PE": "個体群生態学",
  "q-bio.QM": "定量生物学",
  "q-bio.MN": "分子ネットワーク",
  "q-bio.GN": "ゲノム学",
  // Statistics
  "stat.ML": "機械学習",
  "stat.AP": "応用統計",
  "stat.ME": "統計手法",
  "stat.TH": "統計理論",
  // Math
  "math.PR": "確率論",
  "math.ST": "数理統計",
  "math.OC": "最適化",
  // Physics
  "physics.soc-ph": "社会物理学",
  "physics.ao-ph": "大気・海洋物理学",
  "physics.med-ph": "医療物理",
  "cond-mat.stat-mech": "統計力学",
};

/** OpenAlex の概念ラベル（英語）→ 日本語タグ。主要なもののみ */
export const OPENALEX_CONCEPT_MAP: Record<string, string> = {
  "Food security": "食料安全保障",
  "Sustainability": "持続可能性",
  "Climate change": "気候変動",
  "Climate change adaptation": "気候適応",
  "Agriculture": "農業",
  "Agribusiness": "アグリビジネス",
  "Agroecosystem": "農生態系",
  "Agroforestry": "アグロフォレストリー",
  "Agronomy": "農学",
  "Biodiversity": "生物多様性",
  "Biofertilizer": "バイオ肥料",
  "Biofuel": "バイオ燃料",
  "Biorefinery": "バイオリファイナリー",
  "Blockchain": "ブロックチェーン",
  "Blue carbon": "ブルーカーボン",
  "Business": "ビジネス",
  "Circular economy": "循環経済",
  "Corporate governance": "コーポレートガバナンス",
  "Crop": "作物",
  "Curriculum": "カリキュラム",
  "Economics": "経済学",
  "Economic efficiency": "経済効率",
  "Ecosystem services": "生態系サービス",
  "Empowerment": "エンパワーメント",
  "Environmental science": "環境科学",
  "Environmental resource management": "環境資源管理",
  "Experiential learning": "経験学習",
  "Geography": "地理学",
  "Indigenous": "先住民",
  "Labour economics": "労働経済",
  "Land use": "土地利用",
  "Livelihood": "生計",
  "Livestock": "畜産",
  "Mangrove": "マングローブ",
  "Mangrove ecosystem": "マングローブ生態系",
  "Metropolitan area": "都市圏",
  "Natural resource economics": "自然資源経済",
  "Nutrient management": "栄養管理",
  "Oryza sativa": "稲作",
  "Palm oil": "パーム油",
  "Policy": "政策",
  "Political science": "政治学",
  "Population": "人口",
  "Poverty": "貧困",
  "Procurement": "調達",
  "Production (economics)": "生産（経済）",
  "Productivity": "生産性",
  "Profitability index": "収益性",
  "Public health": "公衆衛生",
  "Remittance": "送金",
  "Rural": "農村",
  "Rural area": "農村地域",
  "Social capital": "社会関係資本",
  "Socioeconomics": "社会経済",
  "Soil fertility": "土壌肥沃度",
  "Stakeholder": "ステークホルダー",
  "Subsidy": "補助金",
  "Supply chain": "サプライチェーン",
  "Sustainable Value": "サステナブル価値",
  "Traditional knowledge": "伝統知",
  "Vocational education": "職業教育",
  "Wage": "賃金",
  "Food systems": "食料システム",
};

/**
 * OpenAlex の概念抽出で出てくる「同名異義語ノイズ」。
 * 例: "Distribution (mathematics)" は論文の中身と関係ないことが多い。
 */
export const TAG_EXCLUDE = new Set<string>([
  "openalex",
  "arxiv",
  "Adaptation (eye)",
  "Airport security",
  "Allocative efficiency",
  "Autoregressive integrated moving average",
  "Biosecurity",
  "Certification",
  "Competence (human resources)",
  "Conceptualization",
  "Context (archaeology)",
  "Descriptive statistics",
  "Digestate",
  "Distribution (mathematics)",
  "Diversification (marketing strategy)",
  "Flooding (psychology)",
  "Gold mining",
  "Government (linguistics)",
  "Inclusion (mineral)",
  "Information system",
  "Investment (military)",
  "Nexus (standard)",
  "Nonprobability sampling",
  "Organised crime",
  "Outreach",
  "Plural",
  "Production–possibility frontier",
  "Reservation",
  "Resilience (materials science)",
  "Respondent",
  "SWOT analysis",
  "Sociocultural evolution",
  "Stewardship (theology)",
  "Sustenance",
  "Transformational leadership",
  "New guinea",
  "Weighting",
]);

/** タグ → URL slug（英数字ハイフン） */
const SLUG_OVERRIDE: Record<string, string> = {
  "AI・機械学習": "ai-ml",
  "自然言語処理": "nlp",
  "コンピュータビジョン": "vision",
  "セキュリティ": "security",
  "コンピュータと社会": "cs-society",
  "ゲーム理論": "game-theory",
  "ヒューマンインタフェース": "hci",
  "情報検索": "ir",
  "ニューラル計算": "neural",
  "ロボティクス": "robotics",
  "ソフトウェア工学": "se",
  "データベース": "db",
  "分散・並列計算": "distributed",
  "マルチエージェント": "multi-agent",
  "経済学": "economics",
  "経済理論": "econ-theory",
  "計量経済学": "econometrics",
  "労働経済学": "labor-econ",
  "国際貿易": "intl-trade",
  "ポートフォリオ管理": "portfolio",
  "リスク管理": "risk",
  "金融統計": "fin-stats",
  "計算ファイナンス": "comp-finance",
  "金融経済": "fin-econ",
  "金融全般": "finance",
  "数理ファイナンス": "math-finance",
  "価格付け": "pricing",
  "トレーディング": "trading",
  "神経科学": "neuroscience",
  "個体群生態学": "ecology",
  "定量生物学": "quant-bio",
  "分子ネットワーク": "mol-network",
  "ゲノム学": "genomics",
  "機械学習": "ml",
  "応用統計": "app-stats",
  "統計手法": "stat-methods",
  "統計理論": "stat-theory",
  "確率論": "probability",
  "数理統計": "math-stats",
  "最適化": "optimization",
  "社会物理学": "soc-physics",
  "大気・海洋物理学": "atmosphere",
  "医療物理": "med-physics",
  "統計力学": "stat-mech",
  "農業経済": "agri-econ",
  "気候・環境": "climate",
  "健康・公衆衛生": "health",
  "開発経済": "development",
  "教育": "education",
  "労働・雇用": "labor",
  "貿易・国際経済": "trade",
  "エネルギー": "energy",
  "都市・地域": "urban",
  "行動・心理": "behavior",
  "イノベーション・技術": "innovation",
  "食料システム": "food-system",
  "ファイナンス・保険": "finance",
  "AI・データサイエンス": "ai-tech",
  "神経・脳科学": "neuroscience",
  "歴史・人文・社会": "humanities",
  "公共政策・ガバナンス": "policy",
  "生命科学・進化": "biology",
  "遺伝・ゲノム": "genomics",
  "農学・作物科学": "agronomy",
  "医学・健康": "health",
  "天文・宇宙": "astro",
  "その他": "other",
  "プレプリント": "preprint",
  "査読論文": "peer-reviewed",
};

export function tagToSlug(tag: string): string {
  if (SLUG_OVERRIDE[tag]) return SLUG_OVERRIDE[tag];
  /** 既知でないタグは安全側で encodeURIComponent */
  return encodeURIComponent(tag.toLowerCase().replace(/\s+/g, "-"));
}

/** 既知タグの slug → 表示用日本語タグ（逆引き） */
const SLUG_TO_TAG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_OVERRIDE).map(([tag, slug]) => [slug, tag])
);

export function slugToTag(slug: string): string | null {
  if (SLUG_TO_TAG[slug]) return SLUG_TO_TAG[slug];
  try {
    return decodeURIComponent(slug);
  } catch {
    return null;
  }
}

/**
 * fetch トピックの labelJa は field 側で出すので、categories から表示するときは弾く。
 * 旧データの categories に "開発経済" などが残っていても誤表示にならないようにする保険。
 */
const TOPIC_LABEL_SET: Set<string> = new Set(FETCH_TOPICS.map((t) => t.labelJa));

/** カテゴリ1件を日本語タグへ。マップに無い OpenAlex 概念は素通し、ノイズは null */
export function normalizeCategory(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (TAG_EXCLUDE.has(trimmed)) return null;
  if (trimmed.startsWith("topic:")) return null;
  if (trimmed === "openalex" || trimmed === "arxiv") return null;
  if (TOPIC_LABEL_SET.has(trimmed)) return null;
  /** すでに日本語ラベル（fetchTopics の labelJa 等）はそのまま採用 */
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(trimmed)) return trimmed;
  if (ARXIV_CATEGORY_MAP[trimmed]) return ARXIV_CATEGORY_MAP[trimmed];
  if (OPENALEX_CONCEPT_MAP[trimmed]) return OPENALEX_CONCEPT_MAP[trimmed];
  /** arXiv のドット入りカテゴリで未マップなものはドットの前で切ってヒントだけにする */
  if (/^[a-z\-]+\.[a-z\-]+$/i.test(trimmed)) {
    const prefix = trimmed.split(".")[0];
    const prefixMap: Record<string, string> = {
      cs: "コンピュータ科学",
      econ: "経済学",
      "q-fin": "ファイナンス",
      "q-bio": "生物学",
      stat: "統計学",
      math: "数学",
      physics: "物理学",
      "cond-mat": "物性物理",
    };
    return prefixMap[prefix] ?? null;
  }
  /** 未知の英語 OpenAlex 概念は採用しない（ノイズになりがち） */
  return null;
}
