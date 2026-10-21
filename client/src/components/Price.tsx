import { formatDate, formatKRW } from "@/lib/format";
import { FRESHNESS, PRICE_KIND } from "@/lib/labels";
import type { Freshness, PriceView } from "@/lib/types";
import { SourceLink } from "./SourceLink";
import { Badge } from "./ui";

export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  if (freshness === "current") return null;
  return <Badge tone={freshness === "stale" ? "warn" : "neutral"}>{FRESHNESS[freshness]}</Badge>;
}

/** Card-sized price: amount + option (verbatim, never shortened) + kind + date. */
export function PriceTag({ price }: { price: PriceView | null }) {
  if (!price) {
    return (
      <div className="text-sm">
        <span className="font-bold text-ink-faint">가격 미확인</span>
        <span className="ml-1 text-[11px] text-ink-faint">근거 있는 가격이 아직 없어요</span>
      </div>
    );
  }
  const muted = price.freshness !== "current";
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className={muted ? "text-base font-extrabold text-ink-soft" : "text-base font-extrabold text-ink"}>{formatKRW(price.amount_krw)}</span>
        <span className="text-[11px] font-semibold text-ink-soft">{PRICE_KIND[price.price_kind]}</span>
        <FreshnessBadge freshness={price.freshness} />
      </div>
      <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-soft">
        <span className="font-semibold text-ink">옵션: {price.size_or_option}</span>
        <span className="mx-1 text-line-strong">|</span>
        {formatDate(price.observed_at)} 확인
        {price.option_count && price.option_count > 1 ? <span className="text-ink-faint"> · 옵션 {price.option_count}종</span> : null}
      </div>
    </div>
  );
}

/** Full price table grouped by option — sizes are never merged into one price. */
export function PriceTable({ groups }: { groups: { size_or_option: string; records: PriceView[] }[] }) {
  if (!groups.length) {
    return (
      <p className="rounded-2xl bg-muted-soft px-3 py-3 text-sm text-ink-soft">
        <b>가격 미확인</b> · 출처가 있는 가격 기록이 아직 없어요. 매장 견적은 아래 &lsquo;내 기록&rsquo;에 따로 남길 수 있어요.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.size_or_option} className="overflow-hidden rounded-2xl border-2 border-line">
          <div className="bg-paper-deep px-3 py-1.5 text-xs font-bold text-ink">옵션 · {g.size_or_option}</div>
          <ul className="divide-y divide-line">
            {g.records.map((p, i) => (
              <li key={i} className="px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className={p.freshness === "current" ? "font-extrabold" : "font-extrabold text-ink-soft"}>{formatKRW(p.amount_krw)}</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
                    {PRICE_KIND[p.price_kind]} <FreshnessBadge freshness={p.freshness} />
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-soft">
                  <span>{formatDate(p.observed_at)} 확인</span>
                  <SourceLink url={p.source_url} sourceType={p.source_type} linkStatus={p.link_status} />
                </div>
                {p.note && <p className="mt-0.5 text-[11px] text-ink-faint">메모: {p.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
