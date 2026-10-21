"use client";

import { CheckCircle2, Navigation, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatDate, kakaoDirectionsUrl, kakaoMapSearchUrl, naverMapSearchUrl } from "@/lib/format";
import { useProgress } from "@/lib/hooks";
import { DISPLAY_STATUS, STORE_RELATION } from "@/lib/labels";
import type { StoreSummary } from "@/lib/types";
import { StampMark } from "./Stamp";
import { toast } from "./toast";
import { Badge, cx } from "./ui";

export function DisplayStatusBadge({ store }: { store: Pick<StoreSummary, "display_status" | "verified_at"> }) {
  const tone = store.display_status === "verified_on_display" ? "ok" : store.display_status === "store_only_verified" ? "sky" : "neutral";
  return (
    <Badge tone={tone}>
      {DISPLAY_STATUS[store.display_status]}
      {store.verified_at && <span className="font-normal opacity-80">· {formatDate(store.verified_at)}</span>}
    </Badge>
  );
}

export function directionLinks(store: StoreSummary) {
  const query = store.address || store.name;
  const links: { label: string; href: string }[] = [];
  if (store.map_url) links.push({ label: "지도 링크", href: store.map_url });
  if (store.lat !== null && store.lng !== null) links.push({ label: "카카오 길찾기", href: kakaoDirectionsUrl(store.name, store.lat, store.lng) });
  else links.push({ label: "카카오맵", href: kakaoMapSearchUrl(query) });
  links.push({ label: "네이버지도", href: naverMapSearchUrl(query) });
  return links;
}

export function VisitButton({ storeId, name, compact = false }: { storeId: string; name: string; compact?: boolean }) {
  const { visitedOf, setVisited } = useProgress();
  const [busy, setBusy] = useState(false);
  const visit = visitedOf(storeId);
  const onClick = async () => {
    setBusy(true);
    try {
      await setVisited(storeId, !visit);
      toast(visit ? "방문 도장을 지웠어요" : `${name} 방문 도장 꾹!`);
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
      aria-pressed={!!visit}
      className={cx(
        "inline-flex items-center justify-center gap-1 rounded-full border-2 font-bold transition active:translate-y-px disabled:opacity-60",
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        visit ? "border-stamp bg-stamp-soft text-stamp" : "border-line-strong bg-card text-ink",
      )}
    >
      <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
      {visit ? `방문 완료 ${visit.visited_on ? formatDate(visit.visited_on).slice(5) : ""}` : "방문 도장"}
    </button>
  );
}

export function StoreCard({ store, highlight }: { store: StoreSummary; highlight?: boolean }) {
  const { visitedOf } = useProgress();
  const visited = !!visitedOf(store.id);
  return (
    <article className={cx("relative rounded-2xl border-2 bg-card p-3", highlight ? "border-ink" : "border-line")}>
      <div className="flex flex-wrap items-center gap-1">
        <DisplayStatusBadge store={store} />
        {store.relation && (
          <Badge tone={store.relation === "display_verified" ? "ok" : "neutral"}>{STORE_RELATION[store.relation]}</Badge>
        )}
      </div>
      <h4 className="mt-1 pr-14 text-sm font-bold leading-snug">
        <Link href={`/stores/${store.id}`} className="hover:underline">
          {store.name}
        </Link>
      </h4>
      <p className="text-[11px] text-ink-soft">{store.brands.map((b) => b.name).join(" · ") || "브랜드 미확인"}</p>
      <p className="mt-1 text-xs">{store.address || <span className="text-ink-faint">주소 미확인</span>}</p>
      {store.models_on_display.length > 0 && (
        <p className="mt-1 text-[11px]">
          <span className="font-bold text-ok">전시 확인 모델</span>{" "}
          {store.models_on_display.map((m, i) => (
            <span key={m.id}>
              {i > 0 && ", "}
              <Link href={`/models/${m.id}`} className="underline underline-offset-2">
                {m.name}
              </Link>
            </span>
          ))}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {store.phone && (
          <a href={`tel:${store.phone}`} className="inline-flex items-center gap-1 rounded-full border-2 border-line bg-card px-2.5 py-1 text-[11px] font-semibold">
            <Phone aria-hidden className="h-3 w-3" /> {store.phone}
          </a>
        )}
        {directionLinks(store).map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border-2 border-line bg-card px-2.5 py-1 text-[11px] font-semibold"
          >
            <Navigation aria-hidden className="h-3 w-3" /> {l.label}
          </a>
        ))}
        <VisitButton storeId={store.id} name={store.name} compact />
      </div>
      {visited && (
        <div className="pointer-events-none absolute right-2 top-2">
          <StampMark size="sm" label="방문" tilt={10} />
        </div>
      )}
    </article>
  );
}
