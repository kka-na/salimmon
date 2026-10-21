"use client";

import { BookHeart, MapPin, Scale, Stamp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCompare } from "@/lib/compare";
import { cx } from "./ui";

const TABS = [
  { href: "/", label: "도감", icon: BookHeart, match: (p: string) => p === "/" || /^\/(models|brands|research|reviews)/.test(p) },
  { href: "/map", label: "지도", icon: MapPin, match: (p: string) => /^\/(map|stores)/.test(p) },
  { href: "/compare", label: "비교", icon: Scale, match: (p: string) => p.startsWith("/compare") },
  { href: "/stamps", label: "내 도장", icon: Stamp, match: (p: string) => p.startsWith("/stamps") },
];

export function BottomNav() {
  return <BottomNavFrame pathname={usePathname() || "/"} />;
}

/** Rendered directly (no active tab) as the Suspense fallback while the pathname streams in. */
export function BottomNavFrame({ pathname }: { pathname: string }) {
  const { items } = useCompare();
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] px-3 pb-[max(env(safe-area-inset-bottom),10px)]"
    >
      <ul className="grid grid-cols-4 rounded-[28px] border-2 border-line-strong bg-card/95 p-1.5 shadow-[0_4px_0_0_var(--line-strong),0_10px_30px_-12px_rgba(58,50,66,.35)] backdrop-blur">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex flex-col items-center gap-0.5 rounded-[22px] py-1.5 text-[11px] font-bold transition",
                  active ? "bg-butter text-ink" : "text-ink-faint hover:text-ink-soft",
                )}
              >
                <Icon aria-hidden className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                {label}
                {href === "/compare" && items.length > 0 && (
                  <span className="absolute right-[22%] top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-stamp px-1 text-[10px] text-white">
                    {items.length}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
