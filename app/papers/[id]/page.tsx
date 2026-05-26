import Link from "next/link";
import { notFound } from "next/navigation";

import ReadingPage from "@/components/ReadingPage";
import { getPaperWithSiblings } from "@/lib/data";

type PaperDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function PaperDetailPage({ params }: PaperDetailPageProps) {
  const ctx = await getPaperWithSiblings(params.id);
  if (!ctx) {
    notFound();
  }

  const { paper, date, siblings } = ctx;

  return (
    <div className="pb-24 sm:pb-12">
      <Link
        className="mb-8 inline-flex items-center gap-1 text-sm text-[#6b726b] transition hover:text-[#2f4a3a]"
        href="/"
      >
        ← きょうの一覧
      </Link>
      <ReadingPage paper={paper} date={date} siblings={siblings} />
    </div>
  );
}
