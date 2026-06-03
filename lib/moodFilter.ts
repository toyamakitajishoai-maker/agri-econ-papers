import { resolvePaperSlot } from "@/lib/classifyPaper";
import type { MoodId } from "@/lib/interestProfile";
import type { Paper } from "@/lib/types";

/** 農経サブテーマ（category_l2）でトップ一覧を絞り込み */
export const MOOD_TABS: Array<{ id: MoodId; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "farm-management", label: "生産・農家経営" },
  { id: "market-price", label: "市場・価格・流通" },
  { id: "policy-institution", label: "政策・制度" },
  { id: "climate-sustainability", label: "気候・サステナ" },
  { id: "development", label: "開発・途上国" },
  { id: "agri-ai", label: "フードテック・農業AI" },
  { id: "consumer-behavior", label: "消費・行動経済" },
];

const LEGACY_MOOD_TO_ALL: Record<string, MoodId> = {
  omakase: "all",
  agri: "all",
  econ: "all",
  cs: "all",
  physics: "all",
  bio: "all",
};

export function normalizeMoodId(raw: string | null | undefined): MoodId {
  if (!raw) return "all";
  if (MOOD_TABS.some((t) => t.id === raw)) return raw as MoodId;
  return LEGACY_MOOD_TO_ALL[raw] ?? "all";
}

export function paperMatchesMood(paper: Paper, mood: MoodId): boolean {
  if (mood === "all") return true;
  const l2 = resolvePaperSlot(paper).categoryL2;
  return l2 === mood;
}
