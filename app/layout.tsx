import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "今日の研究を、3分で。",
  description: "論文ではなく、発見を読む。農業・食・農村の最新研究を、小説のように気軽に。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-[#faf8f5] font-sans text-[#1a1f1c] antialiased">
        <header className="sticky top-0 z-30 border-b border-[#ebe7df]/80 bg-[#faf8f5]/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="group">
              <span className="block font-serif text-lg font-semibold tracking-tight text-[#1a1f1c]">
                今日の研究
              </span>
              <span className="block text-[10px] tracking-[0.18em] text-[#8a908a]">3 MIN READ</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-[#5c635c]">
              <Link className="transition hover:text-[#2f4a3a]" href="/">
                きょう
              </Link>
              <Link className="transition hover:text-[#2f4a3a]" href="/archive">
                これまで
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="border-t border-[#ebe7df] py-8 text-center text-xs text-[#9a9f9a]">
          <p>学術論文をもとに、読みやすく編集しています。</p>
        </footer>
      </body>
    </html>
  );
}
