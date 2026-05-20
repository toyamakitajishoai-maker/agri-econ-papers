import { collectJournalCounts } from "@/lib/journal";
import type { Paper } from "@/lib/types";

type JournalSourcesProps = {
  papers: Paper[];
};

export default function JournalSources({ papers }: JournalSourcesProps) {
  const journals = collectJournalCounts(papers);

  if (journals.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-stone-50 p-5 dark:border-stone-700 dark:bg-stone-900/60">
      <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100">今回の一覧に含まれる掲載誌</h2>
      <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
        特定のジャーナルだけを定点監視しているわけではなく、OpenAlex・arXiv 等で農業経済に関連する新着を検索して集めています。
        以下は、この日の一覧に実際に含まれている掲載誌です（{papers.length}件）。
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {journals.map(({ name, count }) => (
          <li
            key={name}
            className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs text-stone-800 dark:border-emerald-900 dark:bg-stone-950 dark:text-stone-200"
          >
            <span className="font-medium">{name}</span>
            <span className="ml-1 text-stone-500 dark:text-stone-400">({count})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
