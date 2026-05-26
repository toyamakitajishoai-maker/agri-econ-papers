"use client";

import Link from "next/link";

type StickyReadCtaProps = {
  label?: string;
};

export default function StickyReadCta({ label = "続きを読む" }: StickyReadCtaProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
      <Link
        href={`#read-body`}
        className="pointer-events-auto flex w-full items-center justify-center rounded-full bg-[#2f4a3a]/95 px-6 py-3.5 text-sm font-medium text-white shadow-lg backdrop-blur"
      >
        {label}
      </Link>
    </div>
  );
}
