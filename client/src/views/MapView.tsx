"use client";

import { List, Map as MapIcon, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { KakaoMap, type MapStatus } from "@/components/KakaoMap";
import { PageHeader } from "@/components/PageHeader";
import { SampleBanner } from "@/components/SampleBanner";
import { StoreCard } from "@/components/StoreCard";
import { Chip, EmptyState, ErrorState, LoadingList, cx } from "@/components/ui";
import { qs } from "@/lib/api";
import type { Brand, Category, ModelDetail, StoreSummary } from "@/lib/types";

const HAS_KEY = Boolean(process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY);

export function MapView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const category = params.get("category") || "";
  const brand = params.get("brand") || "";
  const model = params.get("model") || "";
  const displayOnly = params.get("display") === "1";
  const [mode, setMode] = useState<"map" | "list">(HAS_KEY ? "map" : "list");
  const [status, setStatus] = useState<{ s: MapStatus; detail?: string }>({ s: HAS_KEY ? "loading" : "no_key" });
  const [selected, setSelected] = useState<string | null>(null);

  const setParam = (patch: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    setSelected(null);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };

  const { data: categories } = useSWR<Category[]>("/api/categories");
  const { data: brands } = useSWR<Brand[]>(`/api/brands${qs({ category_id: category })}`);
  const { data: modelInfo } = useSWR<ModelDetail>(model ? `/api/models/${model}` : null);
  const { data, error, isLoading, mutate } = useSWR<{ total: number; items: StoreSummary[] }>(
    `/api/stores${qs({ category_id: category, brand_id: brand, model_id: model, display_verified_only: displayOnly || undefined })}`,
  );

  const stores = useMemo(() => data?.items ?? [], [data]);
  const unmappable = stores.filter((s) => s.lat === null && !s.address);
  const selectedStore = stores.find((s) => s.id === selected) ?? null;
  const mapFailed = status.s === "failed" || status.s === "no_key";
  const showMap = mode === "map" && !mapFailed;

  return (
    <div className="pt-3">
      <PageHeader
        title="실제 출몰지 지도"
        back={false}
        sub="매장 존재와 모델 전시 확인을 구분해서 보여줘요"
        right={
          <div className="flex rounded-full border-2 border-line bg-card p-0.5" role="group" aria-label="보기 방식">
            <button
              type="button"
              onClick={() => setMode("map")}
              aria-pressed={mode === "map"}
              disabled={mapFailed}
              className={cx("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold disabled:opacity-40", mode === "map" && !mapFailed ? "bg-ink text-paper" : "text-ink-soft")}
            >
              <MapIcon aria-hidden className="h-3.5 w-3.5" /> 지도
            </button>
            <button
              type="button"
              onClick={() => setMode("list")}
              aria-pressed={mode === "list" || mapFailed}
              className={cx("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", mode === "list" || mapFailed ? "bg-ink text-paper" : "text-ink-soft")}
            >
              <List aria-hidden className="h-3.5 w-3.5" /> 목록
            </button>
          </div>
        }
      />
      <SampleBanner />

      {/* Filters */}
      <div className="no-scrollbar -mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Chip active={!category} onClick={() => setParam({ category: "", brand: "" })}>
          전체
        </Chip>
        {categories?.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setParam({ category: c.id, brand: "" })}>
            {c.emoji} {c.name}
          </Chip>
        ))}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">브랜드</span>
          <select
            value={brand}
            onChange={(e) => setParam({ brand: e.target.value })}
            className={cx("w-full appearance-none rounded-2xl border-2 bg-card py-2 pl-3 pr-7 text-[13px] font-semibold", brand ? "border-ink" : "border-line text-ink-soft")}
          >
            <option value="">브랜드 전체</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-faint">
            ▼
          </span>
        </label>
        <Chip active={displayOnly} onClick={() => setParam({ display: displayOnly ? "" : "1" })} label="모델 전시가 확인된 매장만 보기">
          전시 확인만
        </Chip>
      </div>
      {model && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border-2 border-ink bg-butter px-3 py-2 text-xs">
          <span className="min-w-0 truncate">
            <b>{modelInfo?.name ?? model}</b> 관련 매장만 보는 중
          </span>
          <button type="button" onClick={() => setParam({ model: "" })} aria-label="모델 필터 해제" className="rounded-full p-1">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Map status notices */}
      {status.s === "no_key" && (
        <p className="mb-3 rounded-2xl bg-sky/70 px-3 py-2 text-xs leading-relaxed text-[#2d5f96]">
          지도 키(<code>NEXT_PUBLIC_KAKAO_MAP_APP_KEY</code>)가 설정되지 않아 목록으로 보여드려요. 각 매장의 외부 지도 링크로 길찾기를 할 수 있어요.
        </p>
      )}
      {status.s === "failed" && (
        <p className="mb-3 rounded-2xl bg-warn-soft px-3 py-2 text-xs leading-relaxed text-[#7a5212]">
          지도를 불러오지 못해 목록으로 전환했어요. ({status.detail})
        </p>
      )}

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <LoadingList />
      ) : !stores.length ? (
        <EmptyState title="조건에 맞는 매장이 없어요" emoji="🏬">
          {displayOnly ? "모델 전시가 확인된 매장은 아직 없어요. '전시 확인만'을 끄면 취급 매장을 볼 수 있어요." : "조사 자료에 등록된 매장이 아직 없어요."}
        </EmptyState>
      ) : (
        <>
          {HAS_KEY && (
            <div
              className={cx(
                "relative -mx-1 mb-3 h-[52vh] min-h-[300px] overflow-hidden rounded-3xl border-2 border-line-strong bg-paper-deep shadow-sticker",
                !showMap && "hidden",
              )}
            >
              <KakaoMap stores={stores} selectedId={selected} onSelect={setSelected} onStatus={(s, detail) => setStatus({ s, detail })} />
              {status.s === "loading" && <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">지도 불러오는 중…</p>}
              <div className="pointer-events-none absolute bottom-2 left-2 rounded-xl bg-card/90 px-2 py-1 text-[10px] leading-tight text-ink-soft">
                <span className="text-ok">●</span> 모델 전시 확인 <span className="ml-1 text-[#4a7fc1]">●</span> 매장만 확인
                <br />
                점선 핀 = 검증 좌표 없음, 주소로 찾은 위치
              </div>
            </div>
          )}

          {showMap && selectedStore && (
            <div className="mb-3">
              <StoreCard store={selectedStore} highlight />
            </div>
          )}

          {(!showMap || !selectedStore) && (
            <>
              <p className="mb-2 px-1 text-[12px] font-semibold text-ink-soft">
                매장 {stores.length}곳{showMap ? " · 핀을 누르면 자세히 보여요" : ""}
              </p>
              <ul className="space-y-2">
                {(showMap ? stores.slice(0, 50) : stores).map((s) => (
                  <li key={s.id}>
                    {showMap ? (
                      <button
                        type="button"
                        onClick={() => setSelected(s.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-line bg-card px-3 py-2 text-left text-sm"
                      >
                        <span className="min-w-0 truncate font-semibold">{s.name}</span>
                        <span className="shrink-0 text-[11px] text-ink-faint">{s.models_on_display.length ? "전시 확인" : s.display_status === "store_only_verified" ? "매장만 확인" : "미확인"}</span>
                      </button>
                    ) : (
                      <StoreCard store={s} />
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {showMap && unmappable.length > 0 && (
            <p className="mt-3 px-1 text-[11px] text-ink-faint">
              주소·좌표가 없어 지도에 못 그린 매장: {unmappable.map((s) => s.name).join(", ")} — 목록 보기에서 확인하세요.
            </p>
          )}
        </>
      )}
      <p className="mt-6 px-1 text-[11px] leading-relaxed text-ink-faint">
        내 위치는 수집하지 않아요. 방문 도장은 직접 눌러서 기록해요. 매장 정보는 조사 시점 기준이니 방문 전 전화로 전시 여부를 확인하세요.
      </p>
    </div>
  );
}
