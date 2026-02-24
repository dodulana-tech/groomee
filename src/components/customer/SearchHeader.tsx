"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface Props {
  total: number;
  isAsap: boolean;
}

export default function SearchHeader({ total, isAsap }: Props) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
          {isAsap ? "⚡ Available now" : "Groomers in Lagos"}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {total} {total === 1 ? "groomer" : "groomers"} found
        </p>
      </div>
      {isAsap && (
        <div className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-50 px-3 py-1.5 text-sm font-semibold text-accent">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
          Emergency mode — showing available groomers only
        </div>
      )}
    </div>
  );
}
