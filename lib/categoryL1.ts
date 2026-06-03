/**
 * @deprecated 選出・表示は lib/classifyPaper.ts を使用してください。
 * 後方互換のため re-export のみ。
 */
export {
  CATEGORY_MAP,
  SLOT_LABELS,
  agriRelevanceScore,
  classifyFromPaper,
  classifyPaper,
  resolvePaperSlot,
} from "@/lib/classifyPaper";

export type { ClassifyResult } from "@/lib/classifyPaper";

import { classifyFromPaper, resolvePaperSlot } from "@/lib/classifyPaper";
import type { CategoryL1, Paper } from "@/lib/types";

export const CATEGORY_L1_LABELS: Record<CategoryL1, string> = {
  "agri-econ": "コア農業経済",
  adjacent: "隣接分野",
  serendipity: "セレンディピティ",
};

export function inferCategoryL1(categories: string[], abstract?: string, title?: string): CategoryL1 {
  return classifyFromPaper({
    id: "",
    title: title ?? "",
    authors: [],
    publishedAt: "",
    url: "",
    pdfUrl: "",
    categories,
    abstract: abstract ?? "",
    summary: { gist: "", novelty: "", method: "", results: "" },
  }).categoryL1;
}

export function inferCategoryL2(paper: Paper): string {
  return resolvePaperSlot(paper).categoryL2;
}
