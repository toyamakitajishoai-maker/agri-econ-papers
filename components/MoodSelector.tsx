"use client";

import { useEffect, useState } from "react";

import { readMoodPreference, saveMoodPreference, type MoodId } from "@/lib/interestProfile";
import { MOOD_TABS } from "@/lib/moodFilter";

type MoodSelectorProps = {
  value?: MoodId;
  onChange?: (mood: MoodId) => void;
};

export default function MoodSelector({ value, onChange }: MoodSelectorProps) {
  const [mood, setMood] = useState<MoodId>("all");

  useEffect(() => {
    setMood(value ?? readMoodPreference());
  }, [value]);

  const select = (id: MoodId) => {
    setMood(id);
    saveMoodPreference(id);
    onChange?.(id);
  };

  return (
    <section
      className="rounded-2xl border border-[#ebe7df] bg-white/90 px-4 py-4 sm:px-5"
      aria-label="テーマで絞り込み"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a8460]">
        テーマで絞り込む
      </p>
      <p className="mt-1 text-sm text-[#5c635c]">
        農業経済のサブテーマごとに、きょうの5本を表示します
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist">
        {MOOD_TABS.map((tab) => {
          const active = mood === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(tab.id)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "bg-[#2f4a3a] text-white"
                  : "bg-[#f0ede6] text-[#4a524a] hover:bg-[#e8e4dc]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
