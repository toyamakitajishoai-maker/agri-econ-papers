import Link from "next/link";

import { tagToSlug } from "@/lib/categoryMap";

type TagChipsProps = {
  tags: string[];
  size?: "sm" | "md";
  /** true ならタグページへのリンク化（既定 true） */
  linked?: boolean;
};

export default function TagChips({ tags, size = "sm", linked = true }: TagChipsProps) {
  if (tags.length === 0) return null;

  const chipClass =
    size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[11px]";

  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const inner = (
          <span
            className={`rounded-full bg-[#eef2ea] font-medium text-[#4a5c4a] transition ${chipClass} ${
              linked ? "hover:bg-[#dde6dc] hover:text-[#1f3326]" : ""
            }`}
          >
            {tag}
          </span>
        );
        return (
          <li key={tag}>
            {linked ? <Link href={`/tags/${tagToSlug(tag)}`}>{inner}</Link> : inner}
          </li>
        );
      })}
    </ul>
  );
}
