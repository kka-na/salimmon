/* eslint-disable @next/next/no-img-element -- product images come from arbitrary, rights-checked origins */
"use client";

import { useState } from "react";

import type { ImageView, ProductKind } from "@/lib/types";
import { cx } from "./ui";

/**
 * Shows the product photo only when the API allowed it (rights confirmed).
 * Otherwise a neutral hand-drawn placeholder — never a fake product picture.
 */
export function ProductImage({
  image,
  kind,
  className,
  showReason = false,
}: {
  image: ImageView;
  kind: ProductKind;
  className?: string;
  showReason?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const url = image.display_url && !failed ? image.display_url : null;

  if (url) {
    return (
      <div className={cx("relative overflow-hidden bg-white", className)}>
        <img src={url} alt={image.alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain" />
      </div>
    );
  }

  const reason = failed
    ? "이미지를 불러오지 못했어요"
    : image.placeholder_reason === "rights_unknown"
      ? "이미지 사용 권리 미확인"
      : "사진 준비 중";

  return (
    <div
      role="img"
      aria-label={`${image.alt} — ${reason}`}
      className={cx("relative flex flex-col items-center justify-center overflow-hidden bg-paper-deep text-ink-faint", className)}
    >
      <Doodle kind={kind} />
      {showReason && <span className="mt-1 px-2 text-center text-[11px] font-medium">{reason}</span>}
    </div>
  );
}

function Doodle({ kind }: { kind: ProductKind }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 64 48" className="h-1/2 max-h-16 w-auto opacity-70" aria-hidden>
      {kind === "mattress" && (
        <g {...common}>
          <rect x="6" y="18" width="52" height="16" rx="6" />
          <path d="M14 26h0M24 26h0M34 26h0M44 26h0M54 26h0" strokeWidth="3" />
          <path d="M10 34v4M54 34v4" />
        </g>
      )}
      {(kind === "bed_frame" || kind === "motion_bed") && (
        <g {...common}>
          <path d="M8 12v26M56 22v16M8 30h48M8 24h48" />
          <rect x="12" y="16" width="12" height="7" rx="3" />
        </g>
      )}
      {kind === "appliance" && (
        <g {...common}>
          <rect x="20" y="4" width="24" height="40" rx="4" />
          <path d="M20 18h24M38 9v5M38 23v6" />
        </g>
      )}
      {(kind === "furniture" || kind === "etc") && (
        <g {...common}>
          <rect x="10" y="10" width="44" height="28" rx="5" />
          <path d="M18 38v4M46 38v4M10 22h44" />
        </g>
      )}
    </svg>
  );
}
