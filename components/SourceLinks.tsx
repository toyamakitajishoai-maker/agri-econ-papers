import type { Paper } from "@/lib/types";
import { getJournalLabel } from "@/lib/journal";

type SourceLinksProps = {
  paper: Paper;
  compact?: boolean;
};

export default function SourceLinks({ paper, compact = false }: SourceLinksProps) {
  const journal = getJournalLabel(paper);
  const authors = paper.authors.join("、") || "著者不明";
  const originalTitle = paper.titleJa ? paper.title : null;

  if (compact) {
    return (
      <p className="text-[11px] leading-relaxed text-[#9a9f9a]">
        {authors}
        {journal !== "掲載誌情報なし" ? ` · ${journal}` : ""}
      </p>
    );
  }

  return (
    <section className="rounded-2xl bg-[#f5f3ef] px-5 py-5 sm:px-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a908a]">出典情報</h2>
      <dl className="mt-4 space-y-3 text-sm text-[#4a504a]">
        {originalTitle ? (
          <>
            <dt className="text-xs text-[#8a908a]">原題</dt>
            <dd className="leading-relaxed text-[#5c635c]">{originalTitle}</dd>
          </>
        ) : null}
        <dt className="text-xs text-[#8a908a]">著者</dt>
        <dd>{authors}</dd>
        <dt className="text-xs text-[#8a908a]">掲載誌</dt>
        <dd>{journal}</dd>
        {paper.doi ? (
          <>
            <dt className="text-xs text-[#8a908a]">DOI</dt>
            <dd className="break-all font-mono text-xs">{paper.doi}</dd>
          </>
        ) : null}
      </dl>
      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <a
          className="rounded-full border border-[#d8ddd4] bg-white px-4 py-2 text-[#3a403c] transition hover:border-[#b8c4b8]"
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          元論文
        </a>
        {paper.pdfUrl ? (
          <a
            className="rounded-full border border-[#d8ddd4] bg-white px-4 py-2 text-[#3a403c] transition hover:border-[#b8c4b8]"
            href={paper.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            PDFで確認
          </a>
        ) : null}
      </div>
    </section>
  );
}
