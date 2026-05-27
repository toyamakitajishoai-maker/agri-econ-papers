"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { GlossaryTerm } from "@/lib/types";

type GlossaryTextProps = {
  text: string;
  glossary?: GlossaryTerm[];
};

type Segment =
  | { kind: "text"; value: string }
  | { kind: "term"; value: string; term: GlossaryTerm };

/** 正規表現特殊文字をエスケープ */
function escapeForRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 用語を本文長い順にマッチさせ、各出現を1回ずつだけハイライト
 */
function buildSegments(text: string, glossary: GlossaryTerm[]): Segment[] {
  if (!text) return [];
  if (glossary.length === 0) return [{ kind: "text", value: text }];

  const sorted = [...glossary].sort((a, b) => b.term.length - a.term.length);
  type Match = { start: number; end: number; term: GlossaryTerm };
  const matches: Match[] = [];
  const usedTerms = new Set<string>();

  for (const term of sorted) {
    if (!term.term.trim()) continue;
    if (usedTerms.has(term.term)) continue;
    const re = new RegExp(escapeForRegExp(term.term), "i");
    const m = re.exec(text);
    if (!m) continue;
    const start = m.index;
    const end = start + m[0].length;
    if (matches.some((x) => !(end <= x.start || start >= x.end))) continue;
    matches.push({ start, end, term });
    usedTerms.add(term.term);
  }

  matches.sort((a, b) => a.start - b.start);
  if (matches.length === 0) return [{ kind: "text", value: text }];

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, m.start) });
    }
    segments.push({
      kind: "term",
      value: text.slice(m.start, m.end),
      term: m.term,
    });
    cursor = m.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }
  return segments;
}

function TermTooltip({ segment, value }: { segment: GlossaryTerm; value: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className="cursor-help border-b border-dotted border-[#9a8460] text-[#3d4540] decoration-[#9a8460]/60 underline-offset-[3px] transition-colors hover:bg-[#fef9ea]"
      >
        {value}
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute left-1/2 z-30 mt-2 w-[min(280px,80vw)] -translate-x-1/2 rounded-xl bg-[#1a1f1c] px-3 py-2 text-xs leading-relaxed text-[#faf8f5] shadow-lg"
          style={{ top: "100%" }}
        >
          <span className="block text-[11px] font-semibold text-[#9a8460]">
            {segment.term}
            {segment.reading ? (
              <span className="ml-1 font-normal text-[#c8cdc8]">／ {segment.reading}</span>
            ) : null}
          </span>
          <span className="mt-1 block text-[#e8ebe8]">{segment.definition}</span>
        </span>
      ) : null}
    </span>
  );
}

export default function GlossaryText({ text, glossary }: GlossaryTextProps) {
  const segments = useMemo(() => buildSegments(text, glossary ?? []), [text, glossary]);

  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i} className="whitespace-pre-line">
            {seg.value}
          </span>
        ) : (
          <TermTooltip key={i} segment={seg.term} value={seg.value} />
        )
      )}
    </>
  );
}
