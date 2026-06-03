import Image from "next/image";

import type { ArticleFigureV2 } from "@/lib/types";

type ArticleFigureV2BlockProps = {
  figure: ArticleFigureV2;
};

export default function ArticleFigureV2Block({ figure }: ArticleFigureV2BlockProps) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-[#e8e4dc] bg-white">
      <div className="relative aspect-[4/3] w-full bg-[#f5f2ec]">
        <Image
          src={figure.imageUrl}
          alt={figure.captionJa}
          fill
          className="object-contain p-2"
          sizes="(max-width: 680px) 100vw, 680px"
        />
      </div>
      <figcaption className="space-y-2 px-5 py-4">
        <p className="text-sm leading-relaxed text-[#3d4540]">{figure.captionJa}</p>
        {figure.whatToSee?.trim() ? (
          <p className="rounded-xl bg-[#faf7f0] px-3 py-2 text-xs leading-relaxed text-[#5c635c]">
            <span className="font-semibold text-[#7c6a45]">👀 この図で見るべき点</span>
            <span className="mt-1 block">{figure.whatToSee}</span>
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
