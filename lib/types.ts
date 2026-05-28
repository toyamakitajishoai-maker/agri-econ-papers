export type PaperSummary = {
  /** 要点（1〜2文） */
  gist: string;
  /** 新規性 */
  novelty: string;
  /** 手法 */
  method: string;
  /** 結果 */
  results: string;
  /** なぜそうなるのか（因果・メカニズム・経路の説明） */
  why?: string;
  /** 主要な図表の説明（アブストラクト等から。数値・軸・比較対象を含む） */
  figures?: string;
};

export type QuizDifficulty = "easy" | "medium" | "hard";

export type PredictionQuiz = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** 難易度（将来の分野別・難易度別統計用、後方互換のため optional） */
  difficulty?: QuizDifficulty;
};

/** 専門用語の解説（要約本文中の語にホバー/タップで意味表示） */
export type GlossaryTerm = {
  /** 要約本文に登場する形（マッチ用） */
  term: string;
  /** 任意：日本語訳・別表記 */
  reading?: string;
  /** 一般読者向けの平易な解説（1〜2文） */
  definition: string;
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
  /** どのセクション用の図か（results=わかったこと / why=なぜそうなるのか） */
  purpose?: "results" | "why";
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
  /** 収集時に割り当てた分野ラベル（例: 気候・環境） */
  field?: string;
  /** 読者向け短縮見出し（Gemini 生成、20〜32字目安） */
  catchTitle?: string;
  /** 1文フック（Gemini 生成） */
  hook?: string;
  /** 記事冒頭の予想クイズ */
  quiz?: PredictionQuiz;
  /** 専門用語の解説（要約本文中の語をホバー/タップで補足） */
  glossary?: GlossaryTerm[];
  /**
   * PDF本文に研究の限界の記述がある場合のみ（Gemini が抜粋）。
   * 空文字 = 処理済みだが該当記述なし。undefined = 未処理（旧データ）
   */
  limitations?: string;
  /** PDF から抽出した主要図（旧形式: 1枚） */
  keyFigure?: KeyFigure;
  /** PDF から抽出した複数図（新形式: わかったこと用・なぜそうなるのか用など） */
  keyFigures?: KeyFigure[];
};
