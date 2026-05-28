import type { Metadata } from "next";

import DashboardClient from "@/components/DashboardClient";

export const metadata: Metadata = {
  title: "これまでのあなた | 今日の研究を、3分で。",
  description: "読破した本数や、触れた分野、連続日数を記録します。",
};

export default function MePage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.18em] text-[#9a8460]">YOUR LIBRARY</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-[#1a1f1c] sm:text-3xl">
          これまでのあなた
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6b726b]">
          記録はこの端末のブラウザに保存されています。淡々と、続けていきましょう。
        </p>
      </section>
      <DashboardClient />
    </div>
  );
}
