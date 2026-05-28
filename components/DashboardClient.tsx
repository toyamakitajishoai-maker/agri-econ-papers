"use client";

import { BookOpen, CheckCircle2, Flame, Layers } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { tagToSlug } from "@/lib/categoryMap";
import { BADGES, computeFieldDistribution, computeKpi, type Kpi } from "@/lib/badges";
import { readStats, type QuizStats } from "@/lib/quizStats";

function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e4dc] bg-white px-4 py-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[#9a8460]">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-serif text-2xl font-semibold text-[#1a1f1c]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#8a908a]">{hint}</p> : null}
    </div>
  );
}

function FieldDistribution({ stats }: { stats: QuizStats }) {
  const dist = computeFieldDistribution(stats);
  if (dist.length === 0) {
    return (
      <p className="text-sm text-[#8a908a]">
        まだ読破した分野がありません。記事を読んだら「読んだ」ボタンを押してみてください。
      </p>
    );
  }
  const max = Math.max(...dist.map((d) => d.count));
  return (
    <ul className="space-y-2">
      {dist.map(({ field, count }) => {
        const ratio = max > 0 ? count / max : 0;
        return (
          <li key={field}>
            <Link
              href={`/tags/${tagToSlug(field)}`}
              className="block rounded-lg px-2 py-1 transition hover:bg-[#faf7f0]"
            >
              <div className="flex items-center justify-between text-xs text-[#3d4540]">
                <span className="font-medium">{field}</span>
                <span className="text-[#8a908a]">{count} 本</span>
              </div>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f0ede6]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={count}
              >
                <div
                  className="h-full rounded-full bg-[#9a8460] transition-[width] duration-300"
                  style={{ width: `${Math.max(8, ratio * 100)}%` }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function BadgeGrid({ stats }: { stats: QuizStats }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {BADGES.map((badge) => {
        const achieved = badge.achieved(stats);
        const { current, goal } = badge.progress(stats);
        return (
          <li
            key={badge.id}
            className={`rounded-2xl border px-4 py-3 transition ${
              achieved
                ? "border-[#cfd9cc] bg-[#eef3ee]"
                : "border-[#e8e4dc] bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-sm font-semibold ${achieved ? "text-[#2f4a3a]" : "text-[#3d4540]"}`}>
                {badge.label}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  achieved ? "bg-[#2f4a3a] text-white" : "bg-[#f0ede6] text-[#8a908a]"
                }`}
              >
                {achieved ? "達成" : `${current} / ${goal}`}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#6b726b]">{badge.description}</p>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardClient() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<QuizStats | null>(null);

  useEffect(() => {
    setMounted(true);
    function refresh() {
      setStats(readStats());
    }
    refresh();
    window.addEventListener("quiz-stats:updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("quiz-stats:updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!mounted || !stats) {
    return (
      <div className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-[#8a908a]">
        読み込み中…
      </div>
    );
  }

  const kpi: Kpi = computeKpi(stats);
  const fresh = kpi.totalRead === 0 && kpi.totalAnswered === 0;

  return (
    <div className="space-y-8">
      {fresh ? (
        <div className="rounded-2xl border border-[#e8e4dc] bg-white px-5 py-5 text-sm leading-relaxed text-[#4a524a]">
          まだ記録はありません。気になる論文を1本読んで、ページ末尾の <span className="font-medium text-[#2f4a3a]">「読んだ」</span> ボタンを押してみてください。クイズに答えると、連続日数も記録されます。
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<BookOpen className="h-3 w-3" strokeWidth={2} />}
          label="読破"
          value={`${kpi.totalRead}`}
          hint="本"
        />
        <KpiCard
          icon={<Flame className="h-3 w-3 text-[#c45c4a]" strokeWidth={2} fill="#e8826a" />}
          label="ストリーク"
          value={`${kpi.streak}`}
          hint="日連続"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-3 w-3" strokeWidth={2} />}
          label="クイズ正解率"
          value={kpi.totalAnswered > 0 ? formatPct(kpi.accuracy) : "—"}
          hint={kpi.totalAnswered > 0 ? `${kpi.totalCorrect} / ${kpi.totalAnswered}` : "未回答"}
        />
        <KpiCard
          icon={<Layers className="h-3 w-3" strokeWidth={2} />}
          label="触れた分野"
          value={`${kpi.fields}`}
          hint="種類"
        />
      </section>

      <section className="rounded-2xl border border-[#e8e4dc] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b726b]">
          分野ごとの読破
        </p>
        <p className="mt-1 text-xs text-[#8a908a]">行をタップすると、その分野の論文一覧へ移動します。</p>
        <div className="mt-4">
          <FieldDistribution stats={stats} />
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b726b]">称号</p>
        <p className="mt-1 text-xs text-[#8a908a]">
          淡々と続けていくほど、あなたの記録が増えていきます。
        </p>
        <div className="mt-4">
          <BadgeGrid stats={stats} />
        </div>
      </section>
    </div>
  );
}
