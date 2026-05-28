import type { StoryCards } from "@/lib/types";

export type StorySlideKey = keyof StoryCards;

export type StorySlideMeta = {
  key: StorySlideKey;
  label: string;
  /** 短い英字ラベル（画像フッター用） */
  labelEn: string;
  index: number;
  accent: string;
  accentMuted: string;
  chipBg: string;
  chipText: string;
  icon: string;
};

export const STORY_SLIDES: StorySlideMeta[] = [
  {
    key: "ask",
    label: "問い",
    labelEn: "ASK",
    index: 0,
    accent: "#2f4a3a",
    accentMuted: "#e8efe9",
    chipBg: "#e8efe9",
    chipText: "#2f4a3a",
    icon: "？",
  },
  {
    key: "method",
    label: "手法",
    labelEn: "HOW",
    index: 1,
    accent: "#4a5f52",
    accentMuted: "#eef2ef",
    chipBg: "#eef2ef",
    chipText: "#3d5248",
    icon: "◎",
  },
  {
    key: "finding",
    label: "発見",
    labelEn: "FIND",
    index: 2,
    accent: "#9a8460",
    accentMuted: "#f2ebd9",
    chipBg: "#f2ebd9",
    chipText: "#7c6a45",
    icon: "✦",
  },
  {
    key: "meaning",
    label: "意味",
    labelEn: "SO WHAT",
    index: 3,
    accent: "#3d5248",
    accentMuted: "#f0f4f1",
    chipBg: "#f0f4f1",
    chipText: "#2f4a3a",
    icon: "→",
  },
];

export const STORY_BRAND = "今日の研究、3分で。";

/** X / Instagram 用の投稿文案 */
export function buildStoryShareCaption(
  catchTitle: string,
  cards: StoryCards,
  url: string
): string {
  const lines = STORY_SLIDES.map(
    (s, i) => `${i + 1}/4【${s.label}】${cards[s.key]}`
  );
  return [`「${catchTitle}」`, "", ...lines, "", STORY_BRAND, url].join("\n");
}
