"use client";

import { motion, useReducedMotion } from "motion/react";

import { formatDate } from "@/lib/format";
import { STAGE } from "@/lib/labels";
import type { Stage, Stamp as StampT } from "@/lib/types";
import { cx } from "./ui";

/** Round rubber-stamp mark. `fresh` plays the thump animation once. */
export function StampMark({
  label,
  sub,
  inked = true,
  fresh = false,
  size = "md",
  tilt = -8,
}: {
  label: string;
  sub?: string;
  inked?: boolean;
  fresh?: boolean;
  size?: "sm" | "md" | "lg";
  tilt?: number;
}) {
  const reduce = useReducedMotion();
  const dims = { sm: "h-12 w-12 text-[10px]", md: "h-16 w-16 text-xs", lg: "h-20 w-20 text-sm" }[size];
  return (
    <motion.div
      initial={fresh && !reduce ? { scale: 1.8, opacity: 0, rotate: tilt - 20 } : false}
      animate={{ scale: 1, opacity: 1, rotate: tilt }}
      transition={{ type: "spring", stiffness: 520, damping: 18 }}
      className={cx(
        "relative flex shrink-0 flex-col items-center justify-center rounded-full border-[3px] text-center font-display leading-tight",
        dims,
        inked ? "border-stamp text-stamp" : "border-dashed border-line-strong text-ink-faint",
      )}
      style={inked ? { boxShadow: "inset 0 0 0 2px rgba(224,87,79,.25)" } : undefined}
    >
      <span>{label}</span>
      {sub && <span className="mt-0.5 font-sans text-[9px] font-semibold opacity-80">{sub}</span>}
    </motion.div>
  );
}

/** The five 도장 slots of one model: 찜 → 체험 예정 → 체험 완료 → 최종 후보 → 구매 완료. */
export function StampTrack({
  stamps,
  current,
  onSelect,
  busy,
  freshStage,
}: {
  stamps: StampT[];
  current: Stage | null;
  onSelect?: (stage: Stage) => void;
  busy?: boolean;
  freshStage?: Stage | null;
}) {
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="도장 진행 단계">
      {stamps.map((s, i) => {
        const meta = STAGE[s.stage];
        const isCurrent = current === s.stage;
        const content = (
          <>
            <StampMark
              size="sm"
              label={meta.short}
              inked={s.reached}
              fresh={freshStage === s.stage}
              tilt={[-10, 6, -4, 8, -6][i]}
            />
            <span className={cx("mt-1 text-[10px] leading-tight", s.reached ? "font-semibold text-ink" : "text-ink-faint")}>
              {meta.label}
            </span>
            <span className="text-[9px] leading-tight text-ink-faint">
              {s.stamped_at ? formatDate(s.stamped_at).slice(5) : s.reached ? "건너뜀" : ""}
            </span>
          </>
        );
        return (
          <li key={s.stage} className="flex flex-col items-center">
            {onSelect ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(s.stage)}
                aria-pressed={isCurrent}
                aria-label={`${meta.label} 도장${isCurrent ? " (현재 단계)" : ""}`}
                className="flex flex-col items-center rounded-2xl p-1 transition active:scale-95 disabled:opacity-60"
              >
                {content}
              </button>
            ) : (
              <div className="flex flex-col items-center p-1">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function emptyStamps(current: Stage | null): StampT[] {
  const order: Stage[] = ["wishlist", "planned", "tried", "finalist", "purchased"];
  const idx = current ? order.indexOf(current) : -1;
  return order.map((stage, i) => ({ stage, reached: i <= idx, stamped_at: null }));
}
