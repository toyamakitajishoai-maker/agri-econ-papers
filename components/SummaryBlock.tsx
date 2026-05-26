import type { ReactNode } from "react";

type SummaryBlockProps = {
  title: string;
  children: ReactNode;
  variant?: "default" | "lead";
};

export default function SummaryBlock({ title, children, variant = "default" }: SummaryBlockProps) {
  return (
    <section className="scroll-mt-24">
      <h2
        className={
          variant === "lead"
            ? "text-sm font-semibold tracking-wide text-[#6b7f6b]"
            : "font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8a908a]"
        }
      >
        {title}
      </h2>
      <div
        className={
          variant === "lead"
            ? "mt-3 space-y-3 text-base leading-[1.85] text-[#2a2f2c] sm:text-[17px]"
            : "mt-3 text-[15px] leading-[1.9] text-[#3a403c] sm:text-base"
        }
      >
        {children}
      </div>
    </section>
  );
}
