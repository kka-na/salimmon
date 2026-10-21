"use client";

import { Check, Scale } from "lucide-react";

import { COMPARE_MAX, useCompare } from "@/lib/compare";
import { toast } from "./toast";
import { cx } from "./ui";

export function CompareButton({
  model,
  variant = "icon",
}: {
  model: { id: string; category_id: string; name: string };
  variant?: "icon" | "full";
}) {
  const { has, toggle, replaceWith } = useCompare();
  const active = has(model.id);

  const onClick = () => {
    const result = toggle({ id: model.id, category_id: model.category_id, name: model.name });
    if (result === "added") toast("비교함에 담았어요");
    else if (result === "removed") toast("비교함에서 뺐어요");
    else if (result === "full") toast(`비교는 최대 ${COMPARE_MAX}개까지예요`);
    else if (result === "category_mismatch") {
      replaceWith({ id: model.id, category_id: model.category_id, name: model.name });
      toast("다른 카테고리라서 비교함을 새로 시작했어요");
    }
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cx(
          "flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 px-3 py-2.5 text-sm font-bold shadow-sticker-sm active:translate-y-px",
          active ? "border-ink bg-ink text-paper" : "border-line-strong bg-card text-ink",
        )}
      >
        {active ? <Check aria-hidden className="h-4 w-4" /> : <Scale aria-hidden className="h-4 w-4" />}
        {active ? "비교함에 있음" : "비교함 담기"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `${model.name} 비교함에서 빼기` : `${model.name} 비교함에 담기`}
      className={cx(
        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition active:scale-95",
        active ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-soft",
      )}
    >
      {active ? <Check aria-hidden className="h-4 w-4" /> : <Scale aria-hidden className="h-4 w-4" />}
    </button>
  );
}
