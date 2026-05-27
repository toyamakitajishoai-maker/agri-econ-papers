type StudyLimitationsProps = {
  text: string;
};

export default function StudyLimitations({ text }: StudyLimitationsProps) {
  return (
    <section className="rounded-2xl border border-[#e8e4dc] bg-[#faf8f5] px-5 py-5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b726b]">
        この研究の限界
      </p>
      <p className="mt-1 text-xs text-[#8a908a]">
        論文の本文（PDF）に著者が書いた限界・制約を抜き出したものです。
      </p>
      <p className="mt-4 whitespace-pre-line text-sm leading-[1.85] text-[#3d4540]">{text}</p>
    </section>
  );
}
