import TagChips from "@/components/TagChips";

type ReadingMetaProps = {
  readMinutes: number;
  tags: string[];
  date?: string;
};

export default function ReadingMeta({ readMinutes, tags, date }: ReadingMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#6b726b]">
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f0ede6] px-2.5 py-1 font-medium text-[#4a524a]">
        <span aria-hidden>⏱</span>
        約 {readMinutes} 分
      </span>
      {date ? <span>{date}</span> : null}
      <TagChips tags={tags} />
    </div>
  );
}
