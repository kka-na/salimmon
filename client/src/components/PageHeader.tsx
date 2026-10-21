"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function PageHeader({ title, back = true, right, sub }: { title: ReactNode; back?: boolean; right?: ReactNode; sub?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-2 border-b-2 border-line bg-paper/90 px-3 py-2.5 backdrop-blur">
      {back && (
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          aria-label="뒤로 가기"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-line bg-card active:translate-y-px"
        >
          <ChevronLeft aria-hidden className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-lg leading-tight">{title}</h1>
        {sub && <div className="truncate text-[11px] text-ink-soft">{sub}</div>}
      </div>
      {right}
    </header>
  );
}
