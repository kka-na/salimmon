"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatDate } from "@/lib/format";
import { CONTENT_ACCESS, EVIDENCE_GRADE, EXCLUSION_REASON, INCENTIVE_CHECK, PLATFORM, PURCHASE_EVIDENCE, SENTIMENT, SPONSORSHIP } from "@/lib/labels";
import type { Review } from "@/lib/types";
import { Markdown } from "./Markdown";
import { SourceLink } from "./SourceLink";
import { Badge, cx } from "./ui";

export function ReviewCard({ review, showModel = false }: { review: Review; showModel?: boolean }) {
  const [open, setOpen] = useState(false);
  const sentimentTone = review.review_sentiment === "positive" ? "mint" : review.review_sentiment === "negative" ? "stamp" : "butter";
  return (
    <article className={cx("rounded-2xl border-2 bg-card p-3", review.is_independent ? "border-line" : "border-dashed border-line-strong bg-muted-soft/50")}>
      <div className="flex flex-wrap items-center gap-1">
        {review.platform && <Badge tone="sky">{PLATFORM[review.platform] ?? review.platform}</Badge>}
        <Badge tone={sentimentTone}>{SENTIMENT[review.review_sentiment]}</Badge>
        {review.review_evidence_grade && (
          <Badge tone={review.review_evidence_grade === "A" ? "ok" : review.review_evidence_grade === "X" ? "stamp" : "lilac"}>
            {EVIDENCE_GRADE[review.review_evidence_grade]}
          </Badge>
        )}
        <Badge tone={review.purchase_evidence_level === "purchase_proof_shown" ? "ok" : "neutral"}>
          {PURCHASE_EVIDENCE[review.purchase_evidence_level]}
        </Badge>
        <Badge tone={review.sponsorship_status === "sponsored_or_provided" ? "stamp" : review.sponsorship_status === "confirmed_uncompensated" ? "ok" : "neutral"}>
          {SPONSORSHIP[review.sponsorship_status]}
        </Badge>
      </div>
      <h4 className="mt-1.5 text-sm font-bold leading-snug">
        <Link href={`/reviews/${review.id}`} className="hover:underline">
          {review.title || review.source_name || `${review.platform ? (PLATFORM[review.platform] ?? review.platform) : "외부"} 게시글 후기`}
        </Link>
      </h4>
      {showModel && (review.model_name || review.brand_name) && (
        <p className="text-[11px] text-ink-soft">
          {review.brand_name}
          {review.model_name ? ` · ${review.model_name}` : " · 브랜드 전반 후기"}
        </p>
      )}
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-ink-soft">
        <dt className="font-semibold">게시일</dt>
        <dd>{review.posted_at ? formatDate(review.posted_at) : "게시일 없음"}</dd>
        <dt className="font-semibold">사용 기간</dt>
        <dd>{review.usage_duration || "진술 없음"}</dd>
        {review.content_access && (
          <>
            <dt className="font-semibold">열람</dt>
            <dd>{CONTENT_ACCESS[review.content_access]}</dd>
          </>
        )}
        {review.incentive_check && (
          <>
            <dt className="font-semibold">보상 점검</dt>
            <dd>{INCENTIVE_CHECK[review.incentive_check]}</dd>
          </>
        )}
        {review.in_period !== null && (
          <>
            <dt className="font-semibold">조사 기간</dt>
            <dd>{review.in_period ? "기간 내 (게시일 확인)" : "기간 외 또는 미확인"}</dd>
          </>
        )}
        <dt className="font-semibold">원문</dt>
        <dd className="min-w-0">
          <SourceLink url={review.source_url} title={review.source_name} linkStatus={review.link_status} compact />
        </dd>
      </dl>
      {!review.is_independent && (
        <p className="mt-2 rounded-xl bg-card px-2 py-1 text-[11px] text-ink-soft">
          독립 후기 집계에서 제외: {review.exclusion_reasons.map((r) => EXCLUSION_REASON[r] ?? r).join(", ")}
        </p>
      )}
      {review.sponsorship_status === "unknown" && review.is_independent && (
        <p className="mt-2 text-[10px] text-ink-faint">협찬 여부 불명·고지 미발견은 무보상이 확인되었다는 뜻이 아니에요.</p>
      )}
      {review.posted_at && review.usage_duration && (
        <p className="mt-1 text-[10px] text-ink-faint">게시일은 {formatDate(review.posted_at)}이며, 사용 기간은 작성자 진술이에요 (구매 시점은 그 이전).</p>
      )}
      {review.body_md && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold text-[#5b4bd6]"
          >
            조사 메모 {open ? "접기" : "펼치기"}
            <ChevronDown aria-hidden className={cx("h-3.5 w-3.5 transition", open && "rotate-180")} />
          </button>
          {open && (
            <div className="mt-1 rounded-xl bg-paper px-3 py-1">
              <Markdown>{review.body_md}</Markdown>
            </div>
          )}
        </>
      )}
    </article>
  );
}
