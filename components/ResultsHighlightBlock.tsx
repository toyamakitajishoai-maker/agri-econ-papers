import GlossaryText from "@/components/GlossaryText";
import type { GlossaryTerm, ResultsHighlight } from "@/lib/types";

type ResultsHighlightBlockProps = {
  data: ResultsHighlight;
  glossary?: GlossaryTerm[];
};

/** 本文中の ε / B を変数として強調 */
function BodyWithVars({ text, glossary }: { text: string; glossary: GlossaryTerm[] }) {
  const parts = text.split(/(ε|B)/);
  return (
    <>
      {parts.map((part, i) =>
        part === "ε" || part === "B" ? (
          <code
            key={`var-${i}`}
            className="rounded bg-[#f2ebd9] px-1 py-0.5 font-mono text-[0.92em] font-semibold text-[#7c6a45]"
          >
            {part}
          </code>
        ) : (
          <GlossaryText key={`txt-${i}`} text={part} glossary={glossary} />
        )
      )}
    </>
  );
}

export default function ResultsHighlightBlock({ data, glossary = [] }: ResultsHighlightBlockProps) {
  return (
    <div className="space-y-5">
      <blockquote className="rounded-2xl border border-[#d8d2c4] bg-[#faf7f0] px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a8460]">
          中心成果
        </p>
        <p className="mt-2 font-serif text-base font-semibold text-[#1a1f1c]">{data.title}</p>
        <p className="mt-3 text-sm leading-[1.9] text-[#3d4540]">
          <BodyWithVars text={data.body} glossary={glossary} />
        </p>
      </blockquote>

      {data.supportItems && data.supportItems.length > 0 ? (
        <div>
          {data.supportIntro ? (
            <p className="text-sm leading-relaxed text-[#6b726b]">{data.supportIntro}</p>
          ) : null}
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-[1.85] text-[#4a524a]">
            {data.supportItems.map((item, i) => (
              <li key={`sup-${i}`}>
                <GlossaryText text={item} glossary={glossary} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
