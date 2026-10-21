"use client";

import { FlaskConical } from "lucide-react";

import { useHealth } from "@/lib/hooks";

/** Shown whenever the loaded research directory contains is_sample data. */
export function SampleBanner() {
  const { data } = useHealth();
  if (!data?.research.has_sample_data) return null;
  return (
    <div role="note" className="mb-3 flex items-start gap-2 rounded-2xl border-2 border-dashed border-warn/50 bg-warn-soft px-3 py-2 text-xs leading-relaxed text-[#7a5212]">
      <FlaskConical aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <b>테스트용 샘플 데이터</b>가 표시되고 있어요. 이름에 [테스트]가 붙은 항목은 가상 정보이며 실제 제품·가격·매장이 아닙니다.
      </p>
    </div>
  );
}
