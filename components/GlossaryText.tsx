"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildSegmentsFromSpans,
  spansFromGlossaryTerms,
  type TextSegment,
} from "@/lib/glossarySpans";
import { stripInlineMarkup } from "@/lib/paperV2Validate";
import type { GlossarySpan, GlossaryTerm } from "@/lib/types";

type GlossaryTextProps = {
  text: string;
  glossary?: GlossaryTerm[];
  /** v2: 位置指定（優先）。本文はプレーンテキストのまま */
  spans?: GlossarySpan[];
};

function escapeForRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** v1 フォールバック: 正規表現マッチ（重なり除去を強化） */
function buildSegmentsLegacy(text: string, glossary: GlossaryTerm[]): TextSegment[] {
  if (!text) return [];
  if (!glossary.length) return [{ kind: "text", value: text }];

  const sorted = [...glossary].sort((a, b) => b.term.length - a.term.length);
  type Match = { start: number; end: number; definition: string; reading?: string; value: string };
  const matches: Match[] = [];

  for (const term of sorted) {
    const label = term.term.trim();
    if (!label) continue;
    const re = new RegExp(escapeForRegExp(label), "i");
    const m = re.exec(text);
    if (!m || m.index === undefined) continue;
    const start = m.index;
    const end = start + m[0].length;
    if (matches.some((x) => !(end <= x.start || start >= x.end))) continue;
    matches.push({
      start,
      end,
      definition: term.definition,
      reading: term.reading,
      value: text.slice(start, end),
    });
  }

  matches.sort((a, b) => a.start - b.start);
  if (matches.length === 0) return [{ kind: "text", value: text }];

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    if (m.start > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, m.start) });
    }
    segments.push({
      kind: "term",
      value: m.value,
      definition: m.definition,
      reading: m.reading,
    });
    cursor = m.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }
  return segments;
}

function resolveSegments(
  text: string,
  glossary: GlossaryTerm[],
  spans?: GlossarySpan[]
): TextSegment[] {
  if (spans?.length) {
    const fromSpans = buildSegmentsFromSpans(text, spans);
    if (fromSpans.length > 1 || (fromSpans.length === 1 && fromSpans[0].kind === "term")) {
      return fromSpans;
    }
  }
  if (glossary.length) {
    const autoSpans = spansFromGlossaryTerms(text, glossary);
    if (autoSpans.length) {
      return buildSegmentsFromSpans(text, autoSpans);
    }
    return buildSegmentsLegacy(text, glossary);
  }
  return [{ kind: "text", value: text }];
}

function TermTooltip({
  value,
  definition,
  reading,
  displayTerm,
}: {
  value: string;
  definition: string;
  reading?: string;
  displayTerm?: string;
}) {
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
    <span ref={wrapperRef} className="relative inline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className="cursor-help border-b border-dotted border-[#9a8460] text-inherit decoration-[#9a8460]/60 underline-offset-[3px] transition-colors hover:bg-[#fef9ea]"
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
            {displayTerm ?? value}
            {reading ? (
              <span className="ml-1 font-normal text-[#c8cdc8]">／ {reading}</span>
            ) : null}
          </span>
          <span className="mt-1 block text-[#e8ebe8]">{definition}</span>
        </span>
      ) : null}
    </span>
  );
}

export default function GlossaryText({ text, glossary = [], spans }: GlossaryTextProps) {
  const plainText = useMemo(() => stripInlineMarkup(text), [text]);
  const segments = useMemo(
    () => resolveSegments(plainText, glossary, spans),
    [plainText, glossary, spans]
  );

  if (!plainText) return null;

  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={`t-${i}`} className="whitespace-pre-line">
            {seg.value}
          </span>
        ) : (
          <TermTooltip
            key={`g-${i}`}
            value={seg.value}
            definition={seg.definition}
            reading={seg.reading}
            displayTerm={seg.value}
          />
        )
      )}
    </>
  );
}
