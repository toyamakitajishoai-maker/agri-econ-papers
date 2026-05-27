import type { KeyFigure, Paper } from "@/lib/types";

type KeyFigureBlockProps = {
  figure: KeyFigure;
  paper: Paper;
  /** ブロック上部に出す見出し（指定なければ purpose や既定値で自動決定） */
  heading?: string;
};

function defaultHeading(figure: KeyFigure): string {
  if (figure.purpose === "results") return "わかったこと（図表）";
  if (figure.purpose === "why") return "なぜそうなるのか（図表）";
  return "主要な結果（図表）";
}

export default function KeyFigureBlock({ figure, paper, heading }: KeyFigureBlockProps) {
  const sourceLabel = paper.titleJa ?? paper.title;
  const headingText = heading ?? defaultHeading(figure);

  return (
    <figure className="overflow-hidden rounded-2xl border border-[#ebe7df] bg-white shadow-sm">
      <div className="bg-[#faf8f5] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a8460]">
          {headingText}
          {figure.label ? ` — ${figure.label}` : ""}
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
