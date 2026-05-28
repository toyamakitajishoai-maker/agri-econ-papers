import Link from "next/link";
import { notFound } from "next/navigation";

import TagChips from "@/components/TagChips";
import { tagToSlug } from "@/lib/categoryMap";
import { buildEditorialView } from "@/lib/editorial";
import { getJournalLabel } from "@/lib/journal";
import { getAllTagsWithCount, getPapersByTagSlug } from "@/lib/tagIndex";

import type { Metadata } from "next";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const tags = await getAllTagsWithCount();
  return tags.map(({ tag }) => ({ slug: tagToSlug(tag) }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { matchedTag } = await getPapersByTagSlug(params.slug);
  const label = matchedTag ?? "タグ";
  return {
    title: `${label} の研究 | 今日の研究を、3分で。`,
    description: `${label} に関する論文の一覧。`,
  };
}

function formatPublishedDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export default async function TagPage({ params }: { params: Params }) {
  const { matchedTag, papers } = await getPapersByTagSlug(params.slug);
  if (!matchedTag) notFound();

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.18em] text-[#9a8460]">TAG</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1f1c] sm:text-3xl">
          {matchedTag} の研究
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6b726b]">
          {papers.length} 件の論文が含まれています。
        </p>
        <p className="mt-3 text-xs">
          <Link href="/archive" className="text-[#6b726b] underline-offset-2 hover:text-[#2f4a3a] hover:underline">
            ← これまでの一覧へ戻る
          </Link>
        </p>
      </section>

      {papers.length === 0 ? (
        <div className="rounded-3xl bg-white px-8 py-12 text-center text-[#6b726b]">
          このタグの論文はまだありません。
        </div>
      ) : (
        <ul className="space-y-4">
          {papers.map(({ paper, date }) => {
            const view = buildEditorialView(paper);
            return (
              <li key={`${date}-${paper.id}`} className="rounded-2xl bg-white px-5 py-4 shadow-sm">
                <p className="text-[11px] tracking-wider text-[#9a9f9a]">{date}</p>
                <Link
                  className="mt-1 block font-serif text-lg font-medium text-[#1a1f1c] transition hover:text-[#2f4a3a]"
                  href={`/papers/${encodeURIComponent(paper.id)}`}
                >
                  {view.catchTitle}
                </Link>
                {paper.titleJa ? (
                  <p className="mt-1 text-xs text-[#8a908a]">{paper.titleJa}</p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed text-[#4a524a]">{view.hook}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#8a908a]">
                  <span>{getJournalLabel(paper)}</span>
                  <span>{formatPublishedDate(paper.publishedAt)}</span>
                </div>
                <div className="mt-3">
                  <TagChips tags={view.tags} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
