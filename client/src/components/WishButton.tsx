"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

import { useProgress } from "@/lib/hooks";
import { STAGE } from "@/lib/labels";
import type { Stage } from "@/lib/types";
import { toast } from "./toast";
import { cx } from "./ui";

/** Heart = the first stamp (찜). Any later stage also counts as wished. */
export function WishButton({ modelId, name }: { modelId: string; name: string }) {
  const { stageOf, setStage } = useProgress();
  const [busy, setBusy] = useState(false);
  const stage: Stage | null = stageOf(modelId);
  const wished = stage !== null;

  const onClick = async () => {
    if (stage && stage !== "wishlist") {
      toast(`이미 '${STAGE[stage].label}' 도장이 있어요 · 상세에서 바꿀 수 있어요`);
      return;
    }
    setBusy(true);
    try {
      await setStage(modelId, wished ? null : "wishlist");
      toast(wished ? "찜을 취소했어요" : "찜 도장 꾹! 💗");
    } catch (e) {
      toast(`저장 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={wished}
      aria-label={wished ? `${name} 찜 취소` : `${name} 찜하기`}
      className={cx(
        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition active:scale-90 disabled:opacity-60",
        wished ? "border-[#f7b9cd] bg-pink text-stamp" : "border-line bg-card text-ink-faint",
      )}
    >
      <Heart aria-hidden className="h-4 w-4" fill={wished ? "currentColor" : "none"} />
    </button>
  );
}
