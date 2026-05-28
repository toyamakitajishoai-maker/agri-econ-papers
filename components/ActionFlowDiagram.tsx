type ActionFlowDiagramProps = {
  steps: string[];
};

/** Mermaid なしのシンプルなフロー図（4ステップ） */
export default function ActionFlowDiagram({ steps }: ActionFlowDiagramProps) {
  if (steps.length < 2) return null;
  return (
    <div
      className="rounded-2xl border border-[#e8e4dc] bg-white px-4 py-5 sm:px-6"
      role="img"
      aria-label="行動から実行までの流れ"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b726b]">
        仕組みの流れ
      </p>
      <ol className="mt-4 space-y-0">
        {steps.map((label, i) => (
          <li key={`flow-${i}`} className="relative flex gap-3 pb-6 last:pb-0">
            {i < steps.length - 1 ? (
              <span
                className="absolute left-[11px] top-7 h-[calc(100%-12px)] w-px bg-[#d8d2c4]"
                aria-hidden
              />
            ) : null}
            <span className="relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2f4a3a] text-[11px] font-semibold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5 text-sm leading-relaxed text-[#3d4540]">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
