"use client";

import { MessageSquareQuote, Store } from "lucide-react";
import Link from "next/link";

import { ENTITY_STATUS, PRODUCT_KIND, STAGE } from "@/lib/labels";
import type { ModelSummary } from "@/lib/types";
import { CompareButton } from "./CompareButton";
import { PriceTag } from "./Price";
import { ProductImage } from "./ProductImage";
import { StampMark } from "./Stamp";
import { WishButton } from "./WishButton";
import { Badge, Card } from "./ui";

export function ModelCard({ model }: { model: ModelSummary }) {
  const stage = model.my_stage;
  return (
    <Card as="article" className="relative overflow-hidden">
      <div className="flex gap-3 p-3">
        <Link href={`/models/${model.id}`} className="shrink-0" tabIndex={-1} aria-hidden>
          <ProductImage image={model.image} kind={model.product_kind} className="h-24 w-24 rounded-2xl border-2 border-line" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <Badge tone={model.product_kind === "mattress" ? "lilac" : model.product_kind === "bed_frame" ? "peach" : "sky"}>
              {PRODUCT_KIND[model.product_kind]}
            </Badge>
            {model.status !== "verified" && <Badge>{ENTITY_STATUS[model.status]}</Badge>}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-ink-soft">{model.brand_name ?? "브랜드 미확인"}</p>
          <h3 className="text-[15px] font-bold leading-snug">
            <Link href={`/models/${model.id}`} className="after:absolute after:inset-0 after:content-['']">
              {model.name}
            </Link>
          </h3>
          {model.model_code && <p className="text-[11px] text-ink-faint">모델코드 {model.model_code}</p>}
        </div>
      </div>

      <div className="border-t-2 border-dashed border-line px-3 py-2.5">
        <PriceTag price={model.representative_price} />
        {(model.top_pro || model.top_con) && (
          <ul className="mt-2 space-y-0.5 text-[12px] leading-snug">
            {model.top_pro && (
              <li className="line-clamp-1">
                <span className="mr-1 font-bold text-ok">장점</span>
                {model.top_pro}
              </li>
            )}
            {model.top_con && (
              <li className="line-clamp-1">
                <span className="mr-1 font-bold text-stamp">주의</span>
                {model.top_con}
              </li>
            )}
          </ul>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
            <span className="inline-flex items-center gap-0.5" title="독립 후기 수 (협찬·근거 부족 글 제외)">
              <MessageSquareQuote aria-hidden className="h-3.5 w-3.5" /> 독립 후기 {model.review_stats.independent}
            </span>
            <span className="inline-flex items-center gap-0.5" title="이 모델의 실물 전시가 확인된 매장 수">
              <Store aria-hidden className="h-3.5 w-3.5" /> 전시 확인 {model.display_store_count}
            </span>
          </div>
          {/* relative z-10 keeps the buttons above the stretched card link */}
          <div className="relative z-10 flex items-center gap-1.5">
            <WishButton modelId={model.id} name={model.name} />
            <CompareButton model={model} />
          </div>
        </div>
      </div>

      {stage && stage !== "wishlist" && (
        <div className="pointer-events-none absolute right-2 top-2">
          <StampMark size="sm" label={STAGE[stage].short} tilt={12} />
        </div>
      )}
    </Card>
  );
}
