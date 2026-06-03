/** 記事 v2 テンプレートの feature flag */
export function isArticleV2FlagEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ARTICLE_V2 === "true";
}
