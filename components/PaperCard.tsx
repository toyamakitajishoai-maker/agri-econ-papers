import Link from "next/link";

import { getJournalLabel } from "@/lib/journal";
import { getSummaryExcerpt, getSummaryHeadline } from "@/lib/summary";
import type { Paper } from "@/lib/types";

type PaperCardProps = {
  paper: Paper;
};

export default function PaperCard({ paper }: PaperCardProps) {
  return (
    <article className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-stone-700 dark:bg-stone-900">
      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        {getSummaryHeadline(paper.summary)}
      </p>
      <h2 className="mt-2 text-lg font-semibold leading-snug text-stone-900 dark:text-stone-100">
        {paper.titleJa ?? paper.title}
      </h2>
      {paper.titleJa ? (
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">原文タイトル: {paper.title}</p>
      ) : null}
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{paper.authors.join(", ") || "著者不明"}</p>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        掲載誌: <span className="text-stone-700 dark:text-stone-300">{getJournalLabel(paper)}</span>
      </p>

      <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
        {getSummaryExcerpt(paper.summary)}
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link className="font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300" href={`/papers/${encodeURIComponent(paper.id)}`}>
          詳細を読む
        </Link>
        <a
          className="text-stone-600 underline-offset-4 hover:underline dark:text-stone-300"
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {paper.source === "openalex" || paper.doi ? "DOI / 本文ページ" : "arXiv"}
        </a>
        {paper.pdfUrl ? (
          <a
            className="text-stone-600 underline-offset-4 hover:underline dark:text-stone-300"
            href={paper.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            PDF（無料公開時のみ）
          </a>
        ) : null}
      </div>
    </article>
  );
}
