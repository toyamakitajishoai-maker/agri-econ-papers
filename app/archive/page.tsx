import Link from "next/link";

import { getAvailableDates, getDailyPapers } from "@/lib/data";
import { getJournalLabel } from "@/lib/journal";
import { buildEditorialView } from "@/lib/editorial";

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
    <div className="space-y-8">
      <section>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#1a1f1c] sm:text-3xl">
          これまでの研究
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6b726b]">
          タイトル・著者・掲載誌など、基本情報だけをまとめています。
        </p>
      </section>

      {dates.length === 0 ? (
        <div className="rounded-3xl bg-white px-8 py-12 text-center text-[#6b726b]">
          まだアーカイブがありません。
        </div>
      ) : (
        <div className="space-y-6">
          {await Promise.all(
            dates.map(async (date) => {
              const papers = await getDailyPapers(date);
              return (
                <section key={date} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                  <h2 className="border-b border-[#f0ede6] px-5 py-4 font-medium text-[#1a1f1c]">
                    {date}
                    <span className="ml-2 text-sm font-normal text-[#8a908a]">({papers.length}件)</span>
                  </h2>

                  {papers.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-[#8a908a]">データなし</p>
                  ) : (
                    <ul className="divide-y divide-[#f5f3ef]">
                      {papers.map((paper) => {
                        const view = buildEditorialView(paper);
                        return (
                          <li key={`${date}-${paper.id}`} className="px-5 py-4">
                            <Link
                              className="font-medium text-[#2f4a3a] hover:underline"
                              href={`/papers/${encodeURIComponent(paper.id)}`}
                            >
                              {view.catchTitle}
                            </Link>
                            {paper.titleJa ? (
                              <p className="mt-1 text-xs text-[#9a9f9a]">{paper.title}</p>
                            ) : null}
                            <dl className="mt-2 grid gap-1 text-xs text-[#6b726b] sm:grid-cols-[4.5rem_1fr]">
                              <dt className="text-[#9a9f9a]">著者</dt>
                              <dd>{paper.authors.join("、") || "—"}</dd>
                              <dt className="text-[#9a9f9a]">掲載誌</dt>
                              <dd>{getJournalLabel(paper)}</dd>
                              <dt className="text-[#9a9f9a]">公開日</dt>
                              <dd>{formatPublishedDate(paper.publishedAt)}</dd>
                            </dl>
                          </li>
                        );
                      })}
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
