import Link from "next/link";

import TagChips from "@/components/TagChips";
import { buildEditorialView } from "@/lib/editorial";
import { getJournalLabel } from "@/lib/journal";
import type { Paper } from "@/lib/types";

type PaperCardEditorialProps = {
  paper: Paper;
  index?: number;
};

export default function PaperCardEditorial({ paper, index }: PaperCardEditorialProps) {
  const view = buildEditorialView(paper);
  const journal = getJournalLabel(paper);

  return (
    <article className="group rounded-3xl bg-white px-5 py-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_30px_rgba(26,31,28,0.04)] transition hover:shadow-[0_2px_0_rgba(0,0,0,0.04),0_12px_40px_rgba(26,31,28,0.07)] sm:px-7 sm:py-7">
      <div className="flex items-start justify-between gap-3">
        <ReadingMetaInline readMinutes={view.readMinutes} tags={view.tags} />
        {typeof index === "number" ? (
          <span className="font-serif text-2xl text-[#e5e0d6]">{String(index + 1).padStart(2, "0")}</span>
        ) : null}
      </div>

      <h2 className="mt-4 font-serif text-xl font-semibold leading-snug tracking-tight text-[#1a1f1c] sm:text-2xl">
        <Link className="hover:text-[#2f4a3a]" href={`/papers/${encodeURIComponent(paper.id)}`}>
          {view.catchTitle}
        </Link>
      </h2>

      <p className="mt-3 text-pretty text-[15px] leading-relaxed text-[#5c635c]">{view.hook}</p>

      <ul className="mt-5 space-y-2 border-l-2 border-[#e8e4dc] pl-4">
        {view.threeLineSummary.map((line, i) => (
          <li key={`${paper.id}-line-${i}`} className="text-sm leading-[1.75] text-[#3a403c]">
            {line}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-sm leading-relaxed text-[#4a524a]">
        <span className="mr-1 font-medium text-[#6b7f6b]">この研究の面白さ</span>
        {view.insight}
      </p>

      <footer className="mt-6 flex flex-col gap-3 border-t border-[#f0ede6] pt-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {paper.titleJa ? (
            <p className="truncate text-[11px] text-[#9a9f9a]">原題: {paper.title}</p>
          ) : null}
          <p className="text-[11px] text-[#9a9f9a]">
            {(paper.authors[0] ?? "著者不明")}
            {paper.authors.length > 1 ? " ほか" : ""}
            {journal !== "掲載誌情報なし" ? ` · ${journal}` : ""}
          </p>
        </div>
        <Link
          href={`/papers/${encodeURIComponent(paper.id)}`}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#2f4a3a] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#243a2d]"
        >
          3分で読む
        </Link>
      </footer>
    </article>
  );
}

function ReadingMetaInline({ readMinutes, tags }: { readMinutes: number; tags: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-[#f0ede6] px-2.5 py-1 text-[11px] font-medium text-[#4a524a]">
        約 {readMinutes} 分
      </span>
      <TagChips tags={tags.slice(0, 3)} />
    </div>
  );
}
