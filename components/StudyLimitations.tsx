type StudyLimitationsProps = {
  text?: string;
  bullets?: string[];
};

export default function StudyLimitations({ text, bullets }: StudyLimitationsProps) {
  const items = bullets?.filter((b) => b.trim()) ?? [];
  const body = text?.trim();
  if (!items.length && !body) return null;

  return (
    <section className="rounded-2xl border border-[#e8e4dc] bg-[#faf8f5] px-5 py-5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b726b]">
        この研究の限界
      </p>
      {body && !items.length ? (
        <p className="mt-1 text-xs text-[#8a908a]">
          論文の本文（PDF）に著者が書いた限界・制約を抜き出したものです。
        </p>
      ) : (
        <p className="mt-1 text-xs text-[#8a908a]">
          読み進めるうえで押さえておきたい前提と、まだ検証されていない点です。
        </p>
      )}
      {items.length > 0 ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-[1.85] text-[#3d4540]">
          {items.map((item, i) => (
            <li key={`lim-${i}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 whitespace-pre-line text-sm leading-[1.85] text-[#3d4540]">{body}</p>
      )}
    </section>
  );
}
