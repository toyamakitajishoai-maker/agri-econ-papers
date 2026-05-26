import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-3xl border border-[#ebe7df] bg-white px-8 py-14 text-center shadow-sm">
      <p className="font-serif text-lg text-[#4a524a]">ページが見つかりません</p>
      <p className="mt-2 text-sm text-[#8a908a]">リンクが古いか、論文が削除された可能性があります。</p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-full bg-[#2f4a3a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#243a2d]"
      >
        きょうの一覧へ
      </Link>
    </div>
  );
}
