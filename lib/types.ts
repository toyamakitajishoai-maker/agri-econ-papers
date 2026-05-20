export type PaperSummary = {
  /** 要点（1〜2文） */
  gist: string;
  /** 新規性 */
  novelty: string;
  /** 手法 */
  method: string;
  /** 結果 */
  results: string;
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
};
