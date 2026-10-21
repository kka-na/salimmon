"use client";

import { Trash2, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import useSWR from "swr";

import { PageHeader } from "@/components/PageHeader";
import { FreshnessBadge } from "@/components/Price";
import { ProductImage } from "@/components/ProductImage";
import { SampleBanner } from "@/components/SampleBanner";
import { Badge, EmptyState, ErrorState, LoadingList, cx } from "@/components/ui";
import { COMPARE_MAX, useCompare } from "@/lib/compare";
import { formatDate, formatKRW, formatSpecValue } from "@/lib/format";
import { PRICE_KIND, PRODUCT_KIND, STAGE } from "@/lib/labels";
import type { CompareResponse, ModelDetail, PriceView } from "@/lib/types";

/** Newest price for one option, preferring current official prices. */
function priceFor(m: ModelDetail, option: string): PriceView | null {
  const group = m.price_table.find((g) => g.size_or_option === option);
  if (!group) return null;
  const rank = (p: PriceView) => [{ current: 0, stale: 1, historical: 2 }[p.freshness], p.price_kind.startsWith("official") ? 0 : 1];
  return [...group.records].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1] || b.observed_at.localeCompare(a.observed_at);
  })[0];
}

function Row({ label, cols, children, hint }: { label: string; cols: number; children: ReactNode[]; hint?: string }) {
  return (
    <div className="border-b-2 border-dashed border-line py-2.5 last:border-0">
      <p className="mb-1.5 px-1 text-[11px] font-bold text-ink-soft">
        {label}
        {hint && <span className="ml-1 font-normal text-ink-faint">{hint}</span>}
      </p>
      <div className={cx("grid gap-2", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {children.map((c, i) => (
          <div key={i} className="min-w-0 break-words text-[12px] leading-snug">
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

const Dash = () => <span className="text-ink-faint">–</span>;

export function CompareView() {
  const { items, remove, clear } = useCompare();
  const key = items.length ? `/api/compare?ids=${items.map((i) => encodeURIComponent(i.id)).join(",")}` : null;
  const { data, error, isLoading, mutate } = useSWR<CompareResponse>(key);

  return (
    <div className="pt-3">
      <PageHeader
        title="나란히 비교"
        back={false}
        sub={`같은 카테고리 최대 ${COMPARE_MAX}개`}
        right={
          items.length > 0 && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full border-2 border-line bg-card px-3 py-1 text-xs font-semibold text-ink-soft">
              <Trash2 aria-hidden className="h-3.5 w-3.5" /> 비우기
            </button>
          )
        }
      />
      <SampleBanner />
      {!items.length ? (
        <EmptyState title="비교함이 비어 있어요" emoji="⚖️">
          도감 카드의 저울 버튼을 눌러 같은 카테고리 모델을 최대 3개까지 담아 보세요.
          <div className="mt-3">
            <Link href="/" className="rounded-full border-2 border-ink bg-ink px-4 py-1.5 text-sm font-bold text-paper">
              도감 보러 가기
            </Link>
          </div>
        </EmptyState>
      ) : error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <LoadingList count={3} />
      ) : (
        <CompareTable data={data} onRemove={remove} />
      )}
      {data && data.missing_ids.length > 0 && (
        <p className="mt-3 text-xs text-stamp">조사 자료에서 사라진 모델이 있어요: {data.missing_ids.join(", ")}</p>
      )}
    </div>
  );
}

function CompareTable({ data, onRemove }: { data: CompareResponse; onRemove: (id: string) => void }) {
  const ms = data.models;
  const n = ms.length;
  return (
    <div className="rounded-3xl border-2 border-line bg-card px-3 py-1 shadow-sticker">
      {/* Header */}
      <div className={cx("sticky top-[58px] z-10 -mx-3 grid gap-2 border-b-2 border-line bg-card px-3 py-3", n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {ms.map((m) => (
          <div key={m.id} className="relative min-w-0">
            <button
              type="button"
              onClick={() => onRemove(m.id)}
              aria-label={`${m.name} 비교에서 빼기`}
              className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-line bg-card"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
            <ProductImage image={m.image} kind={m.product_kind} className="aspect-square w-full rounded-2xl border-2 border-line" />
            <p className="mt-1 truncate text-[10px] font-semibold text-ink-soft">{m.brand_name ?? "브랜드 미확인"}</p>
            <Link href={`/models/${m.id}`} className="line-clamp-2 text-[12px] font-bold leading-tight hover:underline">
              {m.name}
            </Link>
          </div>
        ))}
      </div>
      {n === 1 && <p className="py-3 text-center text-xs text-ink-faint">같은 카테고리 모델을 1~2개 더 담으면 나란히 볼 수 있어요.</p>}

      <Row label="종류" cols={n}>
        {ms.map((m) => (
          <Badge key={m.id} tone={m.product_kind === "mattress" ? "lilac" : "peach"}>
            {PRODUCT_KIND[m.product_kind]}
          </Badge>
        ))}
      </Row>

      <Row label="대표 가격" cols={n} hint="(옵션이 다르면 직접 비교하지 마세요)">
        {ms.map((m) => {
          const p = m.representative_price;
          if (!p) return <span key={m.id} className="font-semibold text-ink-faint">가격 미확인</span>;
          return (
            <div key={m.id}>
              <p className="font-extrabold">{formatKRW(p.amount_krw)}</p>
              <p className="text-[10px] text-ink-soft">{p.size_or_option}</p>
              <p className="text-[10px] text-ink-faint">
                {PRICE_KIND[p.price_kind]} · {formatDate(p.observed_at)}
              </p>
              <FreshnessBadge freshness={p.freshness} />
            </div>
          );
        })}
      </Row>

      {data.price_options.map((opt) => (
        <Row key={opt} label={`가격 · ${opt}`} cols={n}>
          {ms.map((m) => {
            const p = priceFor(m, opt);
            return p ? (
              <div key={m.id}>
                <p className="font-bold">{formatKRW(p.amount_krw)}</p>
                <p className="text-[10px] text-ink-faint">
                  {PRICE_KIND[p.price_kind]} · {formatDate(p.observed_at)}
                </p>
                <FreshnessBadge freshness={p.freshness} />
              </div>
            ) : (
              <Dash key={m.id} />
            );
          })}
        </Row>
      ))}

      {data.spec_keys.map((k) => (
        <Row key={k.key} label={k.label} cols={n}>
          {ms.map((m) => {
            const s = m.specs.find((x) => x.key === k.key);
            if (!s) return <Dash key={m.id} />;
            return (
              <span key={m.id} className={s.value_label === "미확인" ? "text-ink-faint" : undefined}>
                {s.value_label ?? formatSpecValue(s.value, s.unit)}
              </span>
            );
          })}
        </Row>
      ))}

      <Row label="장점" cols={n}>
        {ms.map((m) =>
          m.pros.length ? (
            <ul key={m.id} className="space-y-1">
              {m.pros.slice(0, 3).map((c, i) => (
                <li key={i} className="line-clamp-3">
                  <span className="text-ok">＋</span> {c.text}
                </li>
              ))}
            </ul>
          ) : (
            <Dash key={m.id} />
          ),
        )}
      </Row>
      <Row label="단점·주의" cols={n}>
        {ms.map((m) =>
          m.cons.length ? (
            <ul key={m.id} className="space-y-1">
              {m.cons.slice(0, 3).map((c, i) => (
                <li key={i} className="line-clamp-3">
                  <span className="text-stamp">！</span> {c.text}
                </li>
              ))}
            </ul>
          ) : (
            <Dash key={m.id} />
          ),
        )}
      </Row>
      <Row label="보증·A/S" cols={n}>
        {ms.map((m) => (m.warranty_summary ? <span key={m.id}>{m.warranty_summary}</span> : <span key={m.id} className="text-ink-faint">미확인</span>))}
      </Row>
      <Row label="독립 후기" cols={n} hint="(협찬·근거 부족 제외)">
        {ms.map((m) => (
          <span key={m.id}>
            <b>{m.review_stats.independent}</b>건
            {m.review_stats.independent > 0 && (
              <span className="block text-[10px] text-ink-faint">
                긍정 {m.review_stats.positive} · 부정 {m.review_stats.negative} · 혼합 {m.review_stats.mixed}
              </span>
            )}
          </span>
        ))}
      </Row>
      <Row label="실물 전시 확인 매장" cols={n}>
        {ms.map((m) => (
          <span key={m.id}>
            <b>{m.display_store_count}</b>곳
            <span className="block text-[10px] text-ink-faint">취급 매장 {m.store_count - m.display_store_count}곳</span>
          </span>
        ))}
      </Row>
      <Row label="내 도장" cols={n}>
        {ms.map((m) => (m.my_stage ? <Badge key={m.id} tone="stamp">{STAGE[m.my_stage].label}</Badge> : <Dash key={m.id} />))}
      </Row>
    </div>
  );
}
