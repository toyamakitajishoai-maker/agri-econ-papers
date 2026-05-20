import Link from "next/link";
import { notFound } from "next/navigation";

import SummaryView from "@/components/SummaryView";
import { getPaperById } from "@/lib/data";
import { getJournalLabel } from "@/lib/journal";

type PaperDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function PaperDetailPage({ params }: PaperDetailPageProps) {
  const paper = await getPaperById(params.id);
  if (!paper) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link className="inline-block text-sm text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300" href="/">
          ← 一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{paper.titleJa ?? paper.title}</h1>
        {paper.titleJa ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">原文タイトル: {paper.title}</p>
        ) : null}
        <p className="text-sm text-stone-600 dark:text-stone-300">{paper.authors.join(", ") || "著者不明"}</p>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          掲載誌: <span className="font-medium text-stone-800 dark:text-stone-100">{getJournalLabel(paper)}</span>
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <a className="text-stone-700 underline-offset-4 hover:underline dark:text-stone-200" href={paper.url} target="_blank" rel="noopener noreferrer">
            {paper.source === "openalex" || paper.doi ? "DOI / 本文ページ" : "arXivページ"}
          </a>
          {paper.pdfUrl ? (
            <a
              className="text-stone-700 underline-offset-4 hover:underline dark:text-stone-200"
              href={paper.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              PDF（オープンアクセス）
            </a>
          ) : (
            <span className="text-stone-500 dark:text-stone-400">無料PDFは Unpaywall で見つかりませんでした</span>
          )}
        </div>
      </div>

      <SummaryView summary={paper.summary} />

      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400">原文アブストラクト</h2>
        <p className="mt-2 whitespace-pre-line leading-relaxed text-stone-800 dark:text-stone-200">{paper.abstract}</p>
      </section>
    </div>
  );
}
