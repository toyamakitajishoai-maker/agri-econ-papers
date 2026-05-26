"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-[#faf8f5] font-sans text-[#1a1f1c] antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
          <p className="font-serif text-xl font-semibold text-[#1a1f1c]">エラーが発生しました</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#5c635c]">
            アプリの読み込み中に問題が起きました。開発サーバーを一度止めて、再起動してみてください。
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-8 inline-flex rounded-full bg-[#2f4a3a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#243a2d]"
          >
            再試行
          </button>
        </main>
      </body>
    </html>
  );
}
