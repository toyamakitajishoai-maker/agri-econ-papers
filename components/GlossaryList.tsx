import type { GlossaryTerm } from "@/lib/types";

type GlossaryListProps = {
  terms: GlossaryTerm[];
};

export default function GlossaryList({ terms }: GlossaryListProps) {
  if (!terms.length) return null;
  return (
    <section className="rounded-2xl border border-[#e8e4dc] bg-white px-5 py-5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b726b]">
        この記事の専門用語
      </p>
      <p className="mt-1 text-xs text-[#8a908a]">
        本文の下線つきの語は、カーソルを合わせる／タップすると説明が出ます。
      </p>
      <ul className="mt-4 space-y-3">
        {terms.map((term) => (
          <li key={term.term} className="text-sm leading-relaxed text-[#3d4540]">
            <span className="font-semibold text-[#1a1f1c]">{term.term}</span>
            {term.reading ? (
              <span className="ml-2 text-xs text-[#8a908a]">／ {term.reading}</span>
            ) : null}
            <span className="mt-1 block text-[#5c635c]">{term.definition}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
