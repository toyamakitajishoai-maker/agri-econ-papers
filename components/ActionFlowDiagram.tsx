const DEFAULT_ICONS = ["🤖", "⚖️", "💰", "✅"];

type ActionFlowDiagramProps = {
  steps: string[];
  /** 最終ステップを予算判定の分岐付きで表示 */
  showBudgetBranch?: boolean;
};

function FlowArrow({ vertical }: { vertical: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center text-[#9a8460] ${
        vertical ? "py-1" : "px-1 sm:px-2"
      }`}
      aria-hidden
    >
      {vertical ? "↓" : "→"}
    </span>
  );
}

function FlowStepCard({
  num,
  icon,
  label,
}: {
  num: number;
  icon: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-[#e8e4dc] bg-white px-3 py-4 text-center shadow-sm sm:min-w-[120px]">
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2f4a3a] text-[10px] font-bold text-white">
        {num}
      </span>
      <p className="mt-2 text-xs font-medium leading-snug text-[#3d4540] sm:text-sm">{label}</p>
    </div>
  );
}

/** 横並びフロー（PC）/ 縦並び（スマホ）。最終ステップは予算判定の分岐可 */
export default function ActionFlowDiagram({
  steps,
  showBudgetBranch = false,
}: ActionFlowDiagramProps) {
  if (steps.length < 2) return null;

  const mainSteps = showBudgetBranch && steps.length >= 4 ? steps.slice(0, 3) : steps;
  const lastLabel = showBudgetBranch && steps.length >= 4 ? steps[3] : null;

  return (
    <div
      className="rounded-2xl border border-[#e8e4dc] bg-white px-4 py-5 sm:px-6"
      role="img"
      aria-label="行動から実行までの流れ"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b726b]">
        仕組みの流れ
      </p>

      {/* スマホ: 縦 */}
      <div className="mt-4 flex flex-col items-stretch sm:hidden">
        {mainSteps.map((label, i) => (
          <div key={`flow-v-${i}`} className="flex flex-col items-center">
            <FlowStepCard
              num={i + 1}
              icon={DEFAULT_ICONS[i] ?? "•"}
              label={label}
            />
            {i < mainSteps.length - 1 || lastLabel ? <FlowArrow vertical /> : null}
          </div>
        ))}
        {lastLabel ? (
          <div className="flex flex-col items-center">
            <div className="w-full rounded-xl border border-[#d8d2c4] bg-[#faf7f0] px-3 py-4 text-center">
              <span className="text-xl" aria-hidden>
                ✅
              </span>
              <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#9a8460] text-[10px] font-bold text-white mx-auto">
                4
              </span>
              <p className="mt-2 text-xs font-medium text-[#3d4540]">予算内？</p>
              <div className="mt-3 flex flex-col gap-2">
                <span className="rounded-lg bg-[#eef3ee] px-2 py-1.5 text-xs font-medium text-[#2f4a3a]">
                  Yes → 実行
                </span>
                <span className="rounded-lg bg-[#fdf5f3] px-2 py-1.5 text-xs font-medium text-[#8b4a42]">
                  No → ブロック
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* PC: 横 */}
      <div className="mt-4 hidden items-center justify-center sm:flex sm:flex-wrap sm:gap-y-3">
        {mainSteps.map((label, i) => (
          <div key={`flow-h-${i}`} className="flex items-center">
            <FlowStepCard
              num={i + 1}
              icon={DEFAULT_ICONS[i] ?? "•"}
              label={label}
            />
            {i < mainSteps.length - 1 ? <FlowArrow vertical={false} /> : null}
          </div>
        ))}
        {lastLabel ? (
          <>
            <FlowArrow vertical={false} />
            <div className="flex min-w-[140px] flex-col items-center rounded-xl border border-[#d8d2c4] bg-[#faf7f0] px-3 py-4 text-center">
              <span className="text-xl" aria-hidden>
                ✅
              </span>
              <span className="mt-1 text-xs font-semibold text-[#7c6a45]">予算内？</span>
              <div className="mt-2 space-y-1.5 text-left w-full">
                <span className="block rounded-lg bg-[#eef3ee] px-2 py-1 text-[11px] font-medium text-[#2f4a3a]">
                  Yes → 実行
                </span>
                <span className="block rounded-lg bg-[#fdf5f3] px-2 py-1 text-[11px] font-medium text-[#8b4a42]">
                  No → ブロック
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
