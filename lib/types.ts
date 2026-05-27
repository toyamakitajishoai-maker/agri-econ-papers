export type PaperSummary = {
  /** 要点（1〜2文） */
  gist: string;
  /** 新規性 */
  novelty: string;
  /** 手法 */
  method: string;
  /** 結果 */
  results: string;
  /** 主要な図表の説明（アブストラクト等から。数値・軸・比較対象を含む） */
  figures?: string;
};

export type PredictionQuiz = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

/** 信頼度・エビデンス（0〜100 のゲージ表示用） */
export type EvidenceProfile = {
  /** 1（弱い）〜5（強い） */
  level: number;
  levelLabel: string;
  sampleSize: string;
  studyDesign: string;
  dataQuality: number;
  externalValidity: number;
  notes?: string;
};

export type KeyFigure = {
  /** 例: /figures/W123.png */
  imagePath: string;
  page: number;
  caption: string;
  /** 例: Figure 3 */
  label?: string;
  extractedAt?: string;
  source?: "pdf-image" | "pdf-page";
};

export type Paper = {
  id: string;
  title: string;
  titleJa?: string;
  authors: string[];
  publishedAt: string;
  url: string;
  pdfUrl: string;
  categories: string[];
  abstract: string;
  summary: PaperSummary;
  /** 例: 10.1016/j.xxx */
  doi?: string;
  /** データ取得元 */
  source?: "arxiv" | "openalex";
  /** 掲載誌名（OpenAlex 等から取得） */
  journal?: string;
  /** 読者向け短縮見出し（Gemini 生成、20〜32字目安） */
  catchTitle?: string;
  /** 1文フック（Gemini 生成） */
  hook?: string;
  /** 記事冒頭の予想クイズ */
  quiz?: PredictionQuiz;
  /** エビデンス・サンプルサイズの可視化用 */
  evidence?: EvidenceProfile;
  /** PDF から抽出した主要図（1枚） */
  keyFigure?: KeyFigure;
};
