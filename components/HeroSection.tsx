import Link from "next/link";

type HeroSectionProps = {
  date: string;
  count: number;
  isPastDateDisplay: boolean;
  featuredId?: string;
};

export default function HeroSection({
  date,
  count,
  isPastDateDisplay,
  featuredId,
}: HeroSectionProps) {
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00+09:00`));

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#f7f4ef] via-[#faf8f5] to-[#eef3ee] px-6 py-10 sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#dce8dc]/60 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-[#e8e4dc]/70 blur-2xl" />

      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#6b7f6b]">{formatted}</p>
      <h1 className="mt-3 max-w-xl text-balance font-serif text-3xl font-semibold leading-tight tracking-tight text-[#1a1f1c] sm:text-4xl">
        今日の研究を、3分で。
      </h1>
      <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-[#5c635c] sm:text-base">
        論文ではなく、発見を読むための場所。
        {count > 0 ? ` きょうは ${count} 本に厳選しました。` : ""}
      </p>

      {isPastDateDisplay ? (
        <p className="mt-3 text-xs text-[#8a6f3e]">
          ※ 本日分はまだないため、{date} の一覧を表示しています
        </p>
      ) : null}

      {featuredId ? (
        <Link
          href={`/papers/${encodeURIComponent(featuredId)}`}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#2f4a3a] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#243a2d]"
        >
          今日の1本を読む
          <span aria-hidden>→</span>
        </Link>
      ) : null}
    </section>
  );
}
