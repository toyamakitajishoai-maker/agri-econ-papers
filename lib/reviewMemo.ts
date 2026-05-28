/**
 * 読了後の「あなたの3行メモ」（LocalStorage、端末内のみ）
 */

export type ReviewMemo = {
  line1: string;
  line2: string;
  line3: string;
  updatedAt: string;
};

const KEY = "paper-review-memo-v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readAll(): Record<string, ReviewMemo> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ReviewMemo>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, ReviewMemo>): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new Event("review-memo:updated"));
}

export function getReviewMemo(paperId: string): ReviewMemo | null {
  return readAll()[paperId] ?? null;
}

export function saveReviewMemo(
  paperId: string,
  input: { line1: string; line2: string; line3: string }
): ReviewMemo | null {
  const line1 = input.line1.trim();
  const line2 = input.line2.trim();
  const line3 = input.line3.trim();
  if (!line1 && !line2 && !line3) return null;
  if (!validateReviewText(line1) || !validateReviewText(line2) || !validateReviewText(line3)) {
    return null;
  }
  const memo: ReviewMemo = {
    line1: clip(line1),
    line2: clip(line2),
    line3: clip(line3),
    updatedAt: new Date().toISOString(),
  };
  const map = readAll();
  map[paperId] = memo;
  writeAll(map);
  return memo;
}

export function deleteReviewMemo(paperId: string): void {
  const map = readAll();
  if (!map[paperId]) return;
  delete map[paperId];
  writeAll(map);
}

const MAX_LEN = 80;

function clip(s: string): string {
  return s.length > MAX_LEN ? `${s.slice(0, MAX_LEN)}` : s;
}

/** 軽いスパム・荒らし対策（クライアント側） */
export function validateReviewText(text: string): boolean {
  if (!text) return true;
  if (text.length > MAX_LEN) return false;
  if (/https?:\/\//i.test(text)) return false;
  if (/(.)\1{8,}/.test(text)) return false;
  return true;
}

export function reviewValidationMessage(text: string): string | null {
  if (!text) return null;
  if (text.length > MAX_LEN) return `${MAX_LEN}字以内でお願いします`;
  if (/https?:\/\//i.test(text)) return "URLは入れないでください";
  if (/(.)\1{8,}/.test(text)) return "同じ文字の連続は避けてください";
  return null;
}
