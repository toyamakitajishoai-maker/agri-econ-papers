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
  title = "次に読む1本",
}: RelatedPapersProps) {
  const related = papers.filter((p) => p.id !== currentId).slice(0, 2);
  if (related.length === 0) return null;

  return (
    <section className="mt-12 border-t border-[#ebe7df] pt-10">
      <h2 className="font-serif text-lg font-semibold text-[#1a1f1c]">{title}</h2>
      <ul className="mt-5 space-y-4">
        {related.map((paper) => {
          const view = buildEditorialView(paper);
          return (
            <li key={paper.id}>
              <Link
                href={`/papers/${encodeURIComponent(paper.id)}`}
                className="block rounded-2xl bg-[#f7f4ef] px-5 py-4 transition hover:bg-[#f0ece4]"
              >
                <p className="text-xs text-[#8a908a]">約 {view.readMinutes} 分</p>
                <p className="mt-1 font-serif text-base font-semibold leading-snug text-[#1a1f1c]">
                  {view.catchTitle}
                </p>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#5c635c]">{view.hook}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
