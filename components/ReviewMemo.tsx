"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  deleteReviewMemo,
  getReviewMemo,
  reviewValidationMessage,
  saveReviewMemo,
  validateReviewText,
} from "@/lib/reviewMemo";
import type { Takeaway } from "@/lib/types";

type ReviewMemoProps = {
  paperId: string;
  /** AI生成テイクアウェイ（プレースホルダのヒント用、任意） */
  takeaway?: Takeaway;
};

const FIELDS: Array<{ key: "line1" | "line2" | "line3"; label: string; placeholder: string }> = [
  { key: "line1", label: "印象", placeholder: "例：思ったより身近な話でした" },
  { key: "line2", label: "意外", placeholder: "例：数字の出方がはっきりしていた" },
  { key: "line3", label: "誰に話す", placeholder: "例：同僚にランチで共有したい" },
];

export default function ReviewMemoSection({ paperId, takeaway }: ReviewMemoProps) {
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** スパム用ハニーポット（人間には見えない） */
  const [honeypot, setHoneypot] = useState("");

  function load() {
    const memo = getReviewMemo(paperId);
    if (memo) {
      setLine1(memo.line1);
      setLine2(memo.line2);
      setLine3(memo.line3);
      setSaved(true);
      setEditing(false);
    } else {
      setLine1("");
      setLine2("");
      setLine3("");
      setSaved(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    load();
    function refresh() {
      load();
    }
    window.addEventListener("review-memo:updated", refresh);
    return () => window.removeEventListener("review-memo:updated", refresh);
  }, [paperId]);

  function placeholders(): Record<"line1" | "line2" | "line3", string> {
    if (!takeaway) {
      return Object.fromEntries(FIELDS.map((f) => [f.key, f.placeholder])) as Record<
        "line1" | "line2" | "line3",
        string
      >;
    }
    return {
      line1: takeaway.whatIsIt.slice(0, 50) || FIELDS[0].placeholder,
      line2: takeaway.whatFound.slice(0, 50) || FIELDS[1].placeholder,
      line3: takeaway.soWhat.slice(0, 50) || FIELDS[2].placeholder,
    };
  }

  function handleSave() {
    if (honeypot.trim()) return;
    for (const [val, label] of [
      [line1, "1行目"],
      [line2, "2行目"],
      [line3, "3行目"],
    ] as const) {
      const msg = reviewValidationMessage(val);
      if (msg) {
        setError(`${label}: ${msg}`);
        return;
      }
      if (val && !validateReviewText(val)) {
        setError(`${label}の内容を見直してください`);
        return;
      }
    }
    if (!line1.trim() && !line2.trim() && !line3.trim()) {
      setError("1行以上書いてください");
      return;
    }
    const result = saveReviewMemo(paperId, { line1, line2, line3 });
    if (!result) {
      setError("保存できませんでした");
      return;
    }
    setError(null);
    setSaved(true);
    setEditing(false);
  }

  function handleDelete() {
    deleteReviewMemo(paperId);
    setLine1("");
    setLine2("");
    setLine3("");
    setSaved(false);
    setEditing(true);
    setError(null);
  }

  if (!mounted) {
    return <div aria-hidden className="h-24" />;
  }

  const hints = placeholders();

  if (saved && !editing) {
    return (
      <section className="rounded-2xl border border-[#e8e4dc] bg-white px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a8460]">
              あなたの3行メモ
            </p>
            <p className="mt-1 text-xs text-[#8a908a]">この端末だけに保存されています。</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs text-[#6b726b] underline-offset-2 hover:text-[#2f4a3a] hover:underline"
            >
              <Pencil className="h-3 w-3" />
              編集
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1 text-xs text-[#8a908a] underline-offset-2 hover:text-[#c45c4a] hover:underline"
            >
              <Trash2 className="h-3 w-3" />
              削除
            </button>
          </div>
        </div>
        <ul className="mt-4 space-y-2.5">
          {FIELDS.map(({ key, label }) => {
            const text = key === "line1" ? line1 : key === "line2" ? line2 : line3;
            if (!text) return null;
            return (
              <li key={key} className="flex gap-2 text-sm leading-relaxed text-[#3d4540]">
                <span className="shrink-0 rounded-full bg-[#f2ebd9] px-2 py-0.5 text-[10px] font-medium text-[#7c6a45]">
                  {label}
                </span>
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e8e4dc] bg-white px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a8460]">
        あなたの3行メモ
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[#8a908a]">
        読んだあと、自分の言葉で3行だけ残しておく欄です。友人に話す前のメモにも使えます。
      </p>

      <div className="mt-4 space-y-3">
        {FIELDS.map(({ key, label }) => {
          const value = key === "line1" ? line1 : key === "line2" ? line2 : line3;
          const setValue =
            key === "line1" ? setLine1 : key === "line2" ? setLine2 : setLine3;
          return (
            <label key={key} className="block">
              <span className="text-[11px] font-medium text-[#6b726b]">{label}</span>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={hints[key]}
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-[#e8e4dc] bg-[#faf8f5] px-3 py-2.5 text-sm text-[#1a1f1c] placeholder:text-[#b5bab5] focus:border-[#9a8460] focus:outline-none focus:ring-1 focus:ring-[#9a8460]/30"
              />
            </label>
          );
        })}
      </div>

      {/* ボット向け（表示しない） */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        aria-hidden
      />

      {error ? <p className="mt-2 text-xs text-[#c45c4a]">{error}</p> : null}

      <button
        type="button"
        onClick={handleSave}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#2f4a3a] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#22382b]"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2} />
        保存する
      </button>
    </section>
  );
}
