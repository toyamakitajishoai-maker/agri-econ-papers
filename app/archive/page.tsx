import Link from "next/link";

import { getAvailableDates, getDailyPapers } from "@/lib/data";
import { getJournalLabel } from "@/lib/journal";

function formatPublishedDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export default async function ArchivePage() {
  const dates = await getAvailableDates();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">アーカイブ</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          日付ごとの論文一覧です。タイトル・著者・掲載誌などの基本情報のみを表示しています。
        </p>
      </section>

      {dates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
          アーカイブデータはまだありません。
        </div>
      ) : (
        <div className="space-y-6">
          {await Promise.all(
            dates.map(async (date) => {
              const papers = await getDailyPapers(date);
              return (
                <section
                  key={date}
                  className="rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900"
                >
                  <h2 className="border-b border-stone-200 px-5 py-3 text-lg font-semibold dark:border-stone-700">
                    {date}
                    <span className="ml-2 text-sm font-normal text-stone-500 dark:text-stone-400">
                      ({papers.length}件)
                    </span>
                  </h2>

                  {papers.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-stone-600 dark:text-stone-300">論文データなし</p>
                  ) : (
                    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                      {papers.map((paper) => (
                        <li key={`${date}-${paper.id}`} className="px-5 py-4">
                          <Link
                            className="font-medium text-emerald-800 underline-offset-4 hover:underline dark:text-emerald-300"
                            href={`/papers/${encodeURIComponent(paper.id)}`}
                          >
                            {paper.titleJa ?? paper.title}
                          </Link>
                          {paper.titleJa ? (
                            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{paper.title}</p>
                          ) : null}
                          <dl className="mt-2 grid gap-1 text-sm text-stone-600 dark:text-stone-300 sm:grid-cols-[5rem_1fr]">
                            <dt className="text-stone-500 dark:text-stone-400">著者</dt>
                            <dd>{paper.authors.join("、") || "—"}</dd>
                            <dt className="text-stone-500 dark:text-stone-400">掲載誌</dt>
                            <dd>{getJournalLabel(paper)}</dd>
                            <dt className="text-stone-500 dark:text-stone-400">公開日</dt>
                            <dd>{formatPublishedDate(paper.publishedAt)}</dd>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
