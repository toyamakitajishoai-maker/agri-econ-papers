"use client";

import { useEffect } from "react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-3xl border border-[#ebe7df] bg-white px-8 py-14 text-center shadow-sm">
      <p className="font-serif text-lg text-[#4a524a]">ページの読み込みに失敗しました</p>
      <p className="mt-2 text-sm text-[#8a908a]">
        一時的な不具合の可能性があります。もう一度お試しください。
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex rounded-full bg-[#2f4a3a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#243a2d]"
      >
        再読み込み
      </button>
    </div>
  );
}
