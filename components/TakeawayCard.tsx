"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import type { Takeaway } from "@/lib/types";

type TakeawayCardProps = {
  takeaway: Takeaway;
  catchTitle: string;
  /** 記事の絶対URLが分かれば渡す（無ければ window.location から取る） */
  url?: string;
};

const LABELS: Array<{ key: keyof Takeaway; tag: string }> = [
  { key: "whatIsIt", tag: "なんの研究?" },
  { key: "whatFound", tag: "なにがわかった?" },
  { key: "soWhat", tag: "だから何?" },
];

/** クリップボードへコピー用テキストを組み立て（3行 + キャッチ + URL） */
function composeShareText(takeaway: Takeaway, catchTitle: string, url: string): string {
  const lines = [
    `「${catchTitle}」`,
    "",
    `① ${takeaway.whatIsIt}`,
    `② ${takeaway.whatFound}`,
    `③ ${takeaway.soWhat}`,
    "",
    url,
    "— 今日の研究、3分で。",
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}

export default function TakeawayCard({ takeaway, catchTitle, url }: TakeawayCardProps) {
  const [resolvedUrl, setResolvedUrl] = useState(url ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url && typeof window !== "undefined") {
      setResolvedUrl(window.location.href);
    }
  }, [url]);

  async function handleCopy() {
    const text = composeShareText(takeaway, catchTitle, resolvedUrl);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /** clipboard 失敗時のフォールバック: 一時 textarea */
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* noop */
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <section className="rounded-2xl border border-[#e8e4dc] bg-[#fffdf8] px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a8460]">
            今日のテイクアウェイ
          </p>
          <p className="mt-1 text-xs text-[#8a908a]">友人にこう話せる、3行。</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="3行をコピー"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d8d2c4] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3830] transition hover:bg-[#faf7f0]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" strokeWidth={2.2} />
              コピーしました
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" strokeWidth={2} />
              コピー
            </>
          )}
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {LABELS.map(({ key, tag }) => (
          <li key={key} className="flex gap-3">
            <span className="mt-0.5 shrink-0 rounded-full bg-[#f2ebd9] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#7c6a45]">
              {tag}
            </span>
            <p className="text-sm leading-[1.85] text-[#3d4540]">{takeaway[key]}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
