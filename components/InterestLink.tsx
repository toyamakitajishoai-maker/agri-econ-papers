"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { recordInterestClick } from "@/lib/interestProfile";
import type { Paper } from "@/lib/types";

type InterestLinkProps = ComponentProps<typeof Link> & {
  paper: Paper;
};

export default function InterestLink({ paper, onClick, ...rest }: InterestLinkProps) {
  return (
    <Link
      {...rest}
      onClick={(e) => {
        recordInterestClick(paper);
        onClick?.(e);
      }}
    />
  );
}
