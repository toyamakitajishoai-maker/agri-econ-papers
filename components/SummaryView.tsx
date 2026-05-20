import { getSummaryHeadline, getSummarySections } from "@/lib/summary";
import type { PaperSummary } from "@/lib/types";

type SummaryViewProps = {
  summary: PaperSummary;
};

export default function SummaryView({ summary }: SummaryViewProps) {
  const sections = getSummarySections(summary);
  const headline = getSummaryHeadline(summary);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <div className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400">要点</h2>
          <p className="mt-1 text-lg font-semibold leading-relaxed text-emerald-800 dark:text-emerald-300">
            {headline}
          </p>
        </div>

        {sections
          .filter((section) => section.title !== "要点" && section.title !== "一行サマリ")
          .map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-stone-500 dark:text-stone-400">{section.title}</h3>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-800 dark:text-stone-200">
                {section.body}
              </p>
            </div>
          ))}
      </div>
    </section>
  );
}
