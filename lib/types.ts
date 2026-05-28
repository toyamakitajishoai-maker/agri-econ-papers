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
  /** 各選択肢のフィードバック（options と同じ順・同数） */
  optionExplanations?: string[];
  /** 難易度（将来の分野別・難易度別統計用、後方互換のため optional） */
  difficulty?: QuizDifficulty;
};

/** 読み上げ音声（Gemini TTS で生成） */
export type PaperAudio = {
  /** public 配下からの相対パス。例: /audio/2401.12345v1.wav */
  src: string;
  /** "wav" | "mp3" */
  format: "wav" | "mp3";
  /** 推定再生時間（秒） */
  duration?: number;
  /** 使用した声 (例: Kore, Zephyr) */
  voice?: string;
  /** 生成日時 (ISO8601) */
  generatedAt?: string;
};

/** 4枚スワイプ図解カード（問い→手法→発見→意味） */
export type StoryCards = {
  /** カード1: 何を調べたか（40〜80字） */
  ask: string;
  /** カード2: どう確かめたか */
  method: string;
  /** カード3: 何がわかったか */
  finding: string;
  /** カード4: だから何なのか */
  meaning: string;
};

/** 友人に話せる3行テイクアウェイ（読了後の持ち帰り用） */
export type Takeaway = {
  /** 1行目: 何の研究か（30〜60字目安） */
  whatIsIt: string;
  /** 2行目: 何がわかったか（30〜60字目安） */
  whatFound: string;
  /** 3行目: だから何なのか / So what?（30〜60字目安） */
  soWhat: string;
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

/** アプローチ比較表の1行（論文ページ向けオーバーライド用） */
export type ApproachComparisonRow = {
  approach: string;
  timing: string;
  unit: string;
  irreversible: string;
  /** 本論文の行として強調 */
  highlight?: boolean;
};

/** 「わかったこと」の看板成果ブロック */
export type ResultsHighlight = {
  title: string;
  body: string;
  /** 補助結果の前置き */
  supportIntro?: string;
  /** 補助的な構造結果（箇条書き） */
  supportItems?: string[];
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
  /** フック直後の具体例段落（読者向け・任意） */
  hookLead?: string;
  /** 「まずここだけ」用の3行（指定時は自動生成を上書き） */
  threeLineSummary?: string[];
  /** 「背景」セクション専用テキスト（指定時は gist の代わり） */
  background?: string;
  /** 「わかったこと」の見出し上書き */
  resultsTitle?: string;
  /** 看板成果＋補助結果の構成（指定時は results 段落を置き換え） */
  resultsHighlight?: ResultsHighlight;
  /** アプローチ比較表 */
  approachComparison?: ApproachComparisonRow[];
  /** 限界を箇条書きで（指定時は StudyLimitations でリスト表示） */
  limitationsBullets?: string[];
  /** フロー図用ラベル（4ステップ） */
  flowSteps?: string[];
  /** 記事冒頭の予想クイズ */
  quiz?: PredictionQuiz;
  /** 専門用語の解説（要約本文中の語をホバー/タップで補足） */
  glossary?: GlossaryTerm[];
  /**
   * PDF本文に研究の限界の記述がある場合のみ（Gemini が抜粋）。
   * 空文字 = 処理済みだが該当記述なし。undefined = 未処理（旧データ）
   */
  limitations?: string;
  /** 友人にこう話せる3行テイクアウェイ（読者向けの持ち帰り、Gemini生成） */
  takeaway?: Takeaway;
  /** 4枚スワイプ図解（SNS・会話用の超要約、Gemini生成） */
  storyCards?: StoryCards;
  /** 60秒で聴く要点ナレーション（Gemini TTS で事前生成） */
  audio?: PaperAudio;
  /** PDF から抽出した主要図（旧形式: 1枚） */
  keyFigure?: KeyFigure;
  /** PDF から抽出した複数図（新形式: わかったこと用・なぜそうなるのか用など） */
  keyFigures?: KeyFigure[];
};
