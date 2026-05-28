/**
 * X / LINE / はてブ のシェアボタン。
 * Server Component（リンクのみで状態を持たないため）。
 * 控えめなアイコン中心のデザイン。設計原則：「emoji 多用避ける」「派手にしない」。
 */
import Link from "next/link";

type ShareButtonsProps = {
  /** 記事の絶対URL */
  url: string;
  /** シェア定型文に使う見出し（catchTitle 推奨） */
  title: string;
};

const SHARE_TEXT_SUFFIX = "— 今日の研究、3分で。";

function buildText(title: string): string {
  return `「${title}」 ${SHARE_TEXT_SUFFIX}`;
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
      <path
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.83l4.713 6.231 5.447-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.645Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
      <path
        d="M12 3C6.477 3 2 6.59 2 11c0 3.97 3.61 7.29 8.49 7.92.33.07.78.21.89.49.1.25.06.65.03.91l-.14.86c-.04.25-.21 1 .87.55 1.08-.46 5.83-3.43 7.95-5.88C21.6 14.21 22 12.66 22 11c0-4.41-4.477-8-10-8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HatenaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
      <path
        d="M3 3h6.4c1.7 0 3 .35 3.85 1.05.85.7 1.27 1.7 1.27 3 0 .9-.25 1.65-.75 2.27-.5.62-1.18 1.04-2.03 1.27 1.13.18 2 .63 2.6 1.36.6.72.9 1.62.9 2.72 0 1.5-.5 2.65-1.5 3.46-1 .8-2.45 1.21-4.34 1.21H3V3Zm3.36 6.6h2.27c.7 0 1.23-.15 1.6-.45.36-.3.55-.74.55-1.32 0-.58-.18-1-.55-1.27-.37-.27-.9-.4-1.6-.4H6.36V9.6Zm0 7.05h2.7c.78 0 1.37-.16 1.78-.49.4-.32.6-.8.6-1.43 0-.65-.2-1.14-.62-1.46-.42-.32-1.04-.48-1.86-.48H6.36v3.86Zm12.3 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8ZM18 3h1.66l-.32 11.05h-1l-.34-11.05Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ShareButtons({ url, title }: ShareButtonsProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(buildText(title));

  const xHref = `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
  const lineHref = `https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedText}`;
  const hatebuHref = `https://b.hatena.ne.jp/entry/panel/?url=${encodedUrl}&btitle=${encodeURIComponent(title)}`;

  const baseClass =
    "inline-flex items-center gap-1.5 rounded-full border border-[#e0dcd2] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3830] transition hover:bg-[#faf7f0] hover:text-[#1a1f1c]";

  return (
    <section className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[#8a908a]">この発見を、友人とシェアする</p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Xでシェア"
          className={baseClass}
        >
          <XIcon />
          <span>X</span>
        </Link>
        <Link
          href={lineHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LINEでシェア"
          className={baseClass}
        >
          <LineIcon />
          <span>LINE</span>
        </Link>
        <Link
          href={hatebuHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="はてなブックマークに追加"
          className={baseClass}
        >
          <HatenaIcon />
          <span>はてブ</span>
        </Link>
      </div>
    </section>
  );
}
