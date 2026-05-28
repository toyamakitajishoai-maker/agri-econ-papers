/**
 * 論文本文ゲートの既読状態（クイズ回答 or スキップ）。
 * キー: paper-read-{paperId} / 値: タイムスタンプ（ms）
 * 有効期間: 30日
 */

const KEY_PREFIX = "paper-read-";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const PAPER_READ_UPDATED = "paper-read:updated";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function storageKey(paperId: string): string {
  return `${KEY_PREFIX}${paperId}`;
}

/** 本文ゲートを解除したことを記録 */
export function markPaperRead(paperId: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(storageKey(paperId), String(Date.now()));
    window.dispatchEvent(
      new CustomEvent(PAPER_READ_UPDATED, { detail: { paperId } })
    );
  } catch {
    /* quota / プライベートモード */
  }
}

/** 30日以内に解除済みか */
export function isPaperReadUnlocked(paperId: string): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = window.localStorage.getItem(storageKey(paperId));
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < TTL_MS;
  } catch {
    return false;
  }
}
