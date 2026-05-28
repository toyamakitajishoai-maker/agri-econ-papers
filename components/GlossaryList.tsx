import type { GlossaryTerm } from "@/lib/types";

type GlossaryListProps = {
  terms: GlossaryTerm[];
};

export default function GlossaryList({ terms, defaultOpen = false }: GlossaryListProps & { defaultOpen?: boolean }) {
  if (!terms.length) return null;
  return (
    <details
      className="group rounded-2xl border border-[#e8e4dc] bg-white px-5 py-4 sm:px-6"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-[#6b726b] marker:content-none">
        <span className="group-open:hidden">この記事の専門用語（タップで展開）</span>
        <span className="hidden group-open:inline">この記事の専門用語（タップで閉じる）</span>
      </summary>
      <p className="mt-3 text-xs text-[#8a908a]">
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
    </details>
  );
}
