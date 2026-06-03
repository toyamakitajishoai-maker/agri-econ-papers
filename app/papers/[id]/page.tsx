import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PaperArticleV2 from "@/components/PaperArticleV2";
import ReadingPage from "@/components/ReadingPage";
import { shouldRenderArticleV2 } from "@/lib/articleV2";
import { getPaperWithSiblings } from "@/lib/data";
import { buildEditorialView } from "@/lib/editorial";
import { getMergedRelatedPapers } from "@/lib/relatedPapers";
import { getSiteUrl } from "@/lib/siteUrl";

type PaperDetailPageProps = {
  params: {
    id: string;
  };
};

export async function generateMetadata({ params }: PaperDetailPageProps): Promise<Metadata> {
  const ctx = await getPaperWithSiblings(params.id);
  if (!ctx) {
    return { title: "論文が見つかりませんでした" };
  }
  const { paper } = ctx;
  const view = buildEditorialView(paper);
  const siteUrl = getSiteUrl();
  const path = `/papers/${encodeURIComponent(paper.id)}`;
  const ogImageUrl = `${siteUrl}/api/og?id=${encodeURIComponent(paper.id)}`;

  return {
    metadataBase: new URL(siteUrl),
    title: `${view.catchTitle} | 今日の研究を、3分で。`,
    description: view.hook,
    openGraph: {
      type: "article",
      title: view.catchTitle,
      description: view.hook,
      url: path,
      siteName: "今日の研究を、3分で。",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: view.catchTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: view.catchTitle,
      description: view.hook,
      images: [ogImageUrl],
    },
  };
}

export default async function PaperDetailPage({ params }: PaperDetailPageProps) {
  const ctx = await getPaperWithSiblings(params.id);
  if (!ctx) {
    notFound();
  }

  const { paper, date, siblings } = ctx;
  const related = await getMergedRelatedPapers(paper, date, siblings);

  return (
    <div className="pb-24 sm:pb-12">
      <Link
        className="mb-8 inline-flex items-center gap-1 text-sm text-[#6b726b] transition hover:text-[#2f4a3a]"
        href="/"
      >
        ← きょうの一覧
      </Link>
      {shouldRenderArticleV2(paper) ? (
        <PaperArticleV2 paper={paper} date={date} siblings={related} />
      ) : (
        <ReadingPage paper={paper} date={date} siblings={related} />
      )}
    </div>
  );
}
