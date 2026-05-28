/**
 * サイトの絶対URLを決定する。
 * 優先順:
 *   1. NEXT_PUBLIC_SITE_URL（Vercel/本番で明示推奨）
 *   2. VERCEL_PROJECT_PRODUCTION_URL（Vercel プロダクション）
 *   3. VERCEL_URL（プレビュー）
 *   4. ローカル開発: http://localhost:3000
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod}`.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");

  return "http://localhost:3000";
}
