import JournalSources from "@/components/JournalSources";
import PaperCard from "@/components/PaperCard";
import { getTodayPapers } from "@/lib/data";

export default async function Home() {
  const { date, papers, isPastDateDisplay } = await getTodayPapers();
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">今日の論文</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          表示日: {date}（JST）
          {isPastDateDisplay ? (
            <span className="ml-2 text-amber-800 dark:text-amber-200">
              ※ 本日分がまだないため、直近で論文があった日の一覧を表示しています。
            </span>
          ) : null}
        </p>
      </section>

      {papers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
          本日の対象論文はまだありません。次回の自動更新をお待ちください。
        </div>
      ) : (
        <>
          <JournalSources papers={papers} />
          <section className="grid gap-4 sm:gap-5">
            {papers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
