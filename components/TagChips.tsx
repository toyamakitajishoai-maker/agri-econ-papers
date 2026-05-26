type TagChipsProps = {
  tags: string[];
  size?: "sm" | "md";
};

export default function TagChips({ tags, size = "sm" }: TagChipsProps) {
  if (tags.length === 0) return null;

  const chipClass =
    size === "md"
      ? "px-3 py-1 text-xs"
      : "px-2.5 py-0.5 text-[11px]";

  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li
          key={tag}
          className={`rounded-full bg-[#eef2ea] font-medium text-[#4a5c4a] ${chipClass}`}
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}
