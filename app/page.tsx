import Link from "next/link";

import PaperCardEditorial from "@/components/PaperCardEditorial";
import HeroSection from "@/components/HeroSection";
import { buildEditorialView } from "@/lib/editorial";
import { getTodayPapers } from "@/lib/data";

export default async function Home() {
  const { date, papers, isPastDateDisplay } = await getTodayPapers();
  const featured = papers[0];

  return (
    <div className="space-y-10 sm:space-y-12">
      <HeroSection
        date={date}
        count={papers.length}
        isPastDateDisplay={isPastDateDisplay}
        featuredId={featured?.id}
      />

      {papers.length === 0 ? (
        <div className="rounded-3xl bg-white px-8 py-14 text-center shadow-sm">
          <p className="font-serif text-lg text-[#4a524a]">きょうの研究は、まだ届いていません。</p>
          <p className="mt-2 text-sm text-[#8a908a]">次の更新まで、少しだけお待ちください。</p>
        </div>
      ) : (
        <>
          {featured ? (() => {
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
              <Link
                href={`/papers/${encodeURIComponent(featured.id)}`}
                className="mt-5 inline-flex rounded-full bg-[#2f4a3a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#243a2d]"
              >
                3分で読む →
              </Link>
            </section>
            );
          })() : null}

          <section className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-xl font-semibold text-[#1a1f1c]">きょうの一覧</h2>
              <p className="text-xs text-[#8a908a]">{papers.length} 本</p>
            </div>
            <div className="space-y-5 sm:space-y-6">
              {papers.map((paper, index) => (
                <PaperCardEditorial key={paper.id} paper={paper} index={index} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
