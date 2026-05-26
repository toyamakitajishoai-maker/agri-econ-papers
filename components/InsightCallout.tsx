type InsightCalloutProps = {
  label?: string;
  children: React.ReactNode;
};

export default function InsightCallout({ label = "ひとこと", children }: InsightCalloutProps) {
  return (
    <aside className="rounded-2xl border border-[#e8e2d6] bg-[#faf7f0] px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a8460]">{label}</p>
      <p className="mt-2 text-pretty text-[15px] leading-[1.85] text-[#3d3830] sm:text-base">{children}</p>
    </aside>
  );
}
