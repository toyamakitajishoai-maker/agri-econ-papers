import Link from "next/link";

import { buildEditorialView } from "@/lib/editorial";
import type { Paper } from "@/lib/types";

type RelatedPapersProps = {
  papers: Paper[];
  currentId: string;
  title?: string;
};

export default function RelatedPapers({
  papers,
  currentId,
  title = "関連する論文",
}: RelatedPapersProps) {
  const related = papers.filter((p) => p.id !== currentId).slice(0, 3);
  if (related.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[#e8e4dc] bg-[#faf8f5] px-5 py-6 sm:px-6">
      <h2 className="font-serif text-lg font-semibold text-[#1a1f1c]">{title}</h2>
      <p className="mt-1 text-xs text-[#8a908a]">
        同じタグや近いテーマの研究から、次に読む候補を選びました。
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-1">
        {related.map((paper) => {
          const view = buildEditorialView(paper);
          const tags = view.tags.slice(0, 3);
          return (
            <li key={paper.id}>
              <Link
                href={`/papers/${encodeURIComponent(paper.id)}`}
                className="block rounded-2xl border border-[#ebe7df] bg-white px-5 py-4 transition hover:border-[#d8d2c4] hover:bg-[#fffdf8]"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8a908a]">
                  <span>約 {view.readMinutes} 分</span>
                  {tags.map((tag) => (
                    <span
                      key={`${paper.id}-${tag}`}
                      className="rounded-full bg-[#f0ede6] px-2 py-0.5 text-[10px] text-[#6b726b]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-2 font-serif text-base font-semibold leading-snug text-[#1a1f1c]">
                  {view.catchTitle}
                </p>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#5c635c]">
                  {view.hook}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
