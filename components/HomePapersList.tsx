"use client";

import { useEffect, useMemo, useState } from "react";

import InterestLink from "@/components/InterestLink";
import MoodSelector from "@/components/MoodSelector";
import PaperCardEditorial from "@/components/PaperCardEditorial";
import { buildEditorialView } from "@/lib/editorial";
import { readMoodPreference, type MoodId } from "@/lib/interestProfile";
import { paperMatchesMood } from "@/lib/moodFilter";
import type { Paper } from "@/lib/types";

type HomePapersListProps = {
  papers: Paper[];
};

export default function HomePapersList({ papers }: HomePapersListProps) {
  const [mood, setMood] = useState<MoodId>("all");

  useEffect(() => {
    setMood(readMoodPreference());
  }, []);

  const filtered = useMemo(
    () => papers.filter((p) => paperMatchesMood(p, mood)),
    [papers, mood]
  );

  const featured = papers[0];
  const showFeatured = Boolean(featured && paperMatchesMood(featured, mood));

  if (papers.length === 0) return null;

  return (
    <>
      <MoodSelector
        value={mood}
        onChange={setMood}
      />

      {showFeatured && featured ? (() => {
        const featuredView = buildEditorialView(featured);
        return (
          <section className="rounded-3xl border border-[#ebe7df] bg-white/80 px-5 py-6 sm:px-7 sm:py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a8460]">
              今日のおすすめ
            </p>
            <h2 className="mt-2 font-serif text-xl font-semibold text-[#1a1f1c] sm:text-2xl">
              {featuredView.catchTitle}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#5c635c]">
              {featuredView.hook}
            </p>
            <InterestLink
              href={`/papers/${encodeURIComponent(featured.id)}`}
              paper={featured}
              className="mt-5 inline-flex rounded-full bg-[#2f4a3a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#243a2d]"
            >
              3分で読む →
            </InterestLink>
          </section>
        );
      })() : null}

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-xl font-semibold text-[#1a1f1c]">きょうの一覧</h2>
          <p className="text-xs text-[#8a908a]">
            {mood === "all"
              ? `${papers.length} 本`
              : `${filtered.length} / ${papers.length} 本`}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-[#faf8f5] px-6 py-10 text-center">
            <p className="text-sm text-[#5c635c]">
              この気分に合う論文は、きょうの5本の中にはありませんでした。
            </p>
            <p className="mt-2 text-xs text-[#8a908a]">「すべて」に戻すと全件表示されます。</p>
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {filtered.map((paper, index) => (
              <PaperCardEditorial key={paper.id} paper={paper} index={index} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
