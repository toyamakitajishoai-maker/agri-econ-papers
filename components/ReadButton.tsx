"use client";

import { BookOpenCheck, Check } from "lucide-react";
import { useEffect, useState } from "react";

import { hasRead, setRead } from "@/lib/quizStats";

type ReadButtonProps = {
  paperId: string;
  field?: string;
};

export default function ReadButton({ paperId, field }: ReadButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [read, setReadState] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReadState(hasRead(paperId));
    function refresh() {
      setReadState(hasRead(paperId));
    }
    window.addEventListener("quiz-stats:updated", refresh);
    return () => window.removeEventListener("quiz-stats:updated", refresh);
  }, [paperId]);

  function handleToggle() {
    const next = !read;
    setReadState(next);
    setRead({ paperId, field, read: next });
  }

  if (!mounted) {
    return <div aria-hidden className="h-12" />;
  }

  if (read) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-[#cfd9cc] bg-[#eef3ee] px-5 py-3">
        <div className="flex items-center gap-2 text-sm text-[#2f4a3a]">
          <Check className="h-4 w-4" strokeWidth={2.2} />
          読了として記録しました
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="text-xs text-[#6b726b] underline-offset-2 hover:text-[#2f4a3a] hover:underline"
        >
          取り消す
        </button>
      </section>
    );
  }

  return (
    <section className="flex items-center justify-between gap-3 rounded-2xl border border-[#e0dcd2] bg-white px-5 py-3">
      <p className="text-sm text-[#4a524a]">読み終えたら、記録しておきましょう。</p>
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#2f4a3a] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-[#22382b]"
      >
        <BookOpenCheck className="h-3.5 w-3.5" strokeWidth={2} />
        読んだ
      </button>
    </section>
  );
}
