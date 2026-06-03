import HomePapersList from "@/components/HomePapersList";
import HeroSection from "@/components/HeroSection";
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
        featured={featured}
      />

      {papers.length === 0 ? (
        <div className="rounded-3xl bg-white px-8 py-14 text-center shadow-sm">
          <p className="font-serif text-lg text-[#4a524a]">きょうの研究は、まだ届いていません。</p>
          <p className="mt-2 text-sm text-[#8a908a]">次の更新まで、少しだけお待ちください。</p>
        </div>
      ) : (
        <HomePapersList papers={papers} />
      )}
    </div>
  );
}
