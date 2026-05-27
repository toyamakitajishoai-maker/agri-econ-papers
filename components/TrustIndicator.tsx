import type { EvidenceProfile } from "@/lib/types";

type TrustIndicatorProps = {
  evidence: EvidenceProfile;
};

function StatBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[#5c635c]">{label}</span>
        <span className="font-medium tabular-nums text-[#2f4a3a]">{pct}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#ebe7df]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#6b8f6b] to-[#2f4a3a] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LevelStars({ level }: { level: number }) {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={`star-${i}`}
          className={`text-lg ${i < clamped ? "text-[#9a8460]" : "text-[#e5e0d6]"}`}
          aria-hidden
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function TrustIndicator({ evidence }: TrustIndicatorProps) {
  const level = Math.min(5, Math.max(1, evidence.level));

  return (
    <section className="rounded-3xl border border-[#ebe7df] bg-[#1a1f1c] px-5 py-6 text-[#faf8f5] sm:px-7">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a8460]">
        研究の信頼度ステータス
      </p>
      <p className="mt-1 text-sm text-[#c8cdc8]">ゲームのステータス画面のように、エビデンスの強さを表示します。</p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#252b28] px-4 py-4">
          <p className="text-xs text-[#9a8460]">エビデンスレベル</p>
          <div className="mt-2 flex items-center gap-3">
            <LevelStars level={level} />
            <span className="text-2xl font-bold tabular-nums">{level}</span>
            <span className="text-sm text-[#c8cdc8]">/ 5</span>
          </div>
          <p className="mt-2 text-sm text-[#e8ebe8]">{evidence.levelLabel}</p>
        </div>

        <div className="rounded-2xl bg-[#252b28] px-4 py-4 space-y-3">
          <div>
            <p className="text-xs text-[#9a8460]">サンプル規模</p>
            <p className="mt-1 text-lg font-semibold">{evidence.sampleSize || "記載なし"}</p>
          </div>
          <div>
            <p className="text-xs text-[#9a8460]">研究デザイン</p>
            <p className="mt-1 text-sm leading-relaxed">{evidence.studyDesign}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatBar label="データの質" value={evidence.dataQuality} />
        <StatBar label="一般化しやすさ" value={evidence.externalValidity} />
      </div>

      {evidence.notes?.trim() ? (
        <p className="mt-4 text-xs leading-relaxed text-[#9a9f9a]">{evidence.notes}</p>
      ) : null}
    </section>
  );
}
