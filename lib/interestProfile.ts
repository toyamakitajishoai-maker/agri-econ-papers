import { resolvePaperSlot } from "@/lib/classifyPaper";
import type { CategoryL1, Paper } from "@/lib/types";

const STORAGE_KEY = "interest_vector_v1";
const STORAGE_KEY_L2 = "interest_vector_l2_v1";
const MOOD_KEY = "mood_selector_v2";

export type MoodId =
  | "all"
  | "farm-management"
  | "market-price"
  | "policy-institution"
  | "climate-sustainability"
  | "development"
  | "agri-ai"
  | "consumer-behavior";

export type InterestVector = Partial<Record<CategoryL1, number>>;
export type InterestVectorL2 = Record<string, number>;

const MOOD_TAB_IDS = new Set<MoodId>([
  "all",
  "farm-management",
  "market-price",
  "policy-institution",
  "climate-sustainability",
  "development",
  "agri-ai",
  "consumer-behavior",
]);

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readInterestVector(): InterestVector {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as InterestVector;
  } catch {
    return {};
  }
}

export function readInterestVectorL2(): InterestVectorL2 {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_L2);
    if (!raw) return {};
    return JSON.parse(raw) as InterestVectorL2;
  } catch {
    return {};
  }
}

/** 論文クリック時に枠（l1）とサブテーマ（l2）を記録 */
export function recordInterestClick(paper: Paper): void {
  if (!isBrowser()) return;
  const slot = resolvePaperSlot(paper);

  const l1 = readInterestVector();
  l1[slot.categoryL1] = (l1[slot.categoryL1] ?? 0) + 1;

  const l2 = readInterestVectorL2();
  if (slot.categoryL2) {
    l2[slot.categoryL2] = (l2[slot.categoryL2] ?? 0) + 1;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(l1));
    window.localStorage.setItem(STORAGE_KEY_L2, JSON.stringify(l2));
  } catch {
    /* quota */
  }
}

export function readMoodPreference(): MoodId {
  if (!isBrowser()) return "all";
  try {
    const raw = window.localStorage.getItem(MOOD_KEY);
    if (raw && MOOD_TAB_IDS.has(raw as MoodId)) return raw as MoodId;
    const legacy = window.localStorage.getItem("mood_selector_v1");
    if (legacy === "omakase") return "all";
  } catch {
    /* ignore */
  }
  return "all";
}

export function saveMoodPreference(mood: MoodId): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(MOOD_KEY, mood);
  } catch {
    /* ignore */
  }
}
