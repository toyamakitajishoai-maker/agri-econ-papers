import type { KeyFigure, Paper } from "@/lib/types";

type KeyFigureBlockProps = {
  figure: KeyFigure;
  paper: Paper;
};

export default function KeyFigureBlock({ figure, paper }: KeyFigureBlockProps) {
  const sourceLabel = paper.titleJa ?? paper.title;

  return (
    <figure className="overflow-hidden rounded-2xl border border-[#ebe7df] bg-white shadow-sm">
      <div className="bg-[#faf8f5] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a8460]">
          主要な結果（図表）
        </p>
        <figcaption className="mt-1 text-sm leading-relaxed text-[#4a524a]">{figure.caption}</figcaption>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={figure.imagePath}
        alt={figure.caption}
        className="h-auto w-full border-t border-[#ebe7df] bg-white"
        loading="lazy"
      />
      <p className="border-t border-[#f0ede6] px-4 py-3 text-[11px] leading-relaxed text-[#9a9f9a]">
        論文 PDF {figure.page} ページより（出典: {sourceLabel.slice(0, 60)}
        {sourceLabel.length > 60 ? "…" : ""}）
      </p>
    </figure>
  );
}
