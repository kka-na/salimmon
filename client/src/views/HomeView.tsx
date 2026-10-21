"use client";

import { BookOpen, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";

import { ModelCard } from "@/components/ModelCard";
import { SampleBanner } from "@/components/SampleBanner";
import { Chip, EmptyState, ErrorState, LoadingList, cx } from "@/components/ui";
import { qs } from "@/lib/api";
import { useProgress } from "@/lib/hooks";
import { PRODUCT_KIND, PRODUCT_KIND_ORDER, STAGE, STAGES } from "@/lib/labels";
import type { Brand, Category, ModelSummary } from "@/lib/types";

const PRICE_RANGES: { id: string; label: string; min?: number; max?: number }[] = [
  { id: "", label: "가격 전체" },
  { id: "u50", label: "50만원 이하", max: 500000 },
  { id: "50-100", label: "50~100만원", min: 500000, max: 1000000 },
  { id: "100-200", label: "100~200만원", min: 1000000, max: 2000000 },
  { id: "200-400", label: "200~400만원", min: 2000000, max: 4000000 },
  { id: "o400", label: "400만원 이상", min: 4000000 },
];

const SORTS = [
  { id: "default", label: "브랜드순" },
  { id: "price_asc", label: "낮은 가격순" },
  { id: "price_desc", label: "높은 가격순" },
  { id: "updated", label: "최근 갱신순" },
];

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          "w-full appearance-none truncate rounded-2xl border-2 bg-card py-2 pl-3 pr-7 text-[13px] font-semibold",
          value && value !== "default" ? "border-ink text-ink" : "border-line text-ink-soft",
        )}
      >
        {children}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-faint">
        ▼
      </span>
    </label>
  );
}

export function HomeView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: progress } = useProgress();

  const { data: categories, error: catError, mutate: retryCats, isLoading: catLoading } = useSWR<Category[]>("/api/categories");

  const categoryId = params.get("category") || categories?.[0]?.id || "";
  const kind = params.get("kind") || "";
  const brand = params.get("brand") || "";
  const price = params.get("price") || "";
  const stage = params.get("stage") || "";
  const sort = params.get("sort") || "default";
  const q = params.get("q") || "";
  const [query, setQuery] = useState(q);
  const [showFilters, setShowFilters] = useState(Boolean(brand || price || stage || sort !== "default"));

  const setParam = (patch: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };

  // Debounced search box → URL
  useEffect(() => {
    if (query === q) return;
    const t = setTimeout(() => setParam({ q: query.trim() }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const category = categories?.find((c) => c.id === categoryId);
  const range = PRICE_RANGES.find((r) => r.id === price);
  const modelsKey = categoryId
    ? `/api/models${qs({
        category_id: categoryId,
        product_kind: kind,
        brand_id: brand,
        q,
        price_min: range?.min,
        price_max: range?.max,
        progress: stage,
        sort,
      })}`
    : null;
  const { data: models, error: modelError, isLoading: modelsLoading, mutate: retryModels } = useSWR<{ total: number; items: ModelSummary[] }>(modelsKey);
  const { data: brands } = useSWR<Brand[]>(categoryId ? `/api/brands${qs({ category_id: categoryId })}` : null);

  let grouped: { brandId: string; name: string; items: ModelSummary[] }[] | null = null;
  if (models && sort === "default") {
    const map = new Map<string, { brandId: string; name: string; items: ModelSummary[] }>();
    for (const m of models.items) {
      if (!map.has(m.brand_id)) map.set(m.brand_id, { brandId: m.brand_id, name: m.brand_name ?? "브랜드 미확인", items: [] });
      map.get(m.brand_id)!.items.push(m);
    }
    grouped = [...map.values()];
  }

  const stampCount = progress ? progress.models.reduce((n, m) => n + m.stage_index + 1, 0) + progress.stores.length : 0;
  const activeFilterCount = [kind, brand, price, stage, q].filter(Boolean).length + (sort !== "default" ? 1 : 0);

  return (
    <div className="pt-5">
      {/* Hero */}
      <header className="relative mb-4 overflow-hidden rounded-[28px] border-2 border-line-strong bg-butter px-4 pb-4 pt-4 shadow-sticker">
        <div aria-hidden className="absolute -right-4 -top-5 h-24 w-24 rounded-full bg-pink/80" />
        <div aria-hidden className="absolute -bottom-6 right-12 h-14 w-14 rounded-full bg-mint/90" />
        <p className="relative text-xs font-bold text-[#8a6a12]">살림몬 혼수 도감</p>
        <h1 className="relative mt-0.5 font-display text-[26px] leading-tight">
          우리 집 혼수
          <br />
          도장깨기 <span aria-hidden>🏠</span>
        </h1>
        <div className="relative mt-3 flex items-center gap-2 text-xs">
          <Link href="/stamps" className="rounded-full border-2 border-ink/80 bg-card px-3 py-1 font-bold">
            모은 도장 {stampCount}개
          </Link>
          <span className="text-[#8a6a12]">찜하고 체험하고 고르는 기록장</span>
        </div>
      </header>

      <SampleBanner />

      {/* Search */}
      <div className="relative mb-3">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="브랜드·모델명 검색"
          aria-label="브랜드 또는 모델명 검색"
          className="w-full rounded-2xl border-2 border-line bg-card py-2.5 pl-10 pr-10 text-sm shadow-sticker-sm placeholder:text-ink-faint"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-faint">
            <X aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>

      {catError ? (
        <ErrorState error={catError} onRetry={() => retryCats()} />
      ) : catLoading ? (
        <LoadingList />
      ) : !categories?.length ? (
        <EmptyState title="아직 조사된 카테고리가 없어요" emoji="📭">
          조사 에이전트가 <code>research/categories/*.md</code>를 추가하면 도감 탭이 자동으로 생겨요.
        </EmptyState>
      ) : (
        <>
          {/* Category tabs (generated from research/categories/*.md) */}
          <div role="tablist" aria-label="카테고리" className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {categories.map((c) => {
              const active = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setParam({ category: c.id, kind: "", brand: "" })}
                  className={cx(
                    "flex shrink-0 items-center gap-1.5 rounded-2xl border-2 px-3.5 py-2 text-sm font-bold transition active:translate-y-px",
                    active ? "border-ink bg-card shadow-sticker-sm" : "border-transparent bg-paper-deep text-ink-soft",
                  )}
                >
                  <span aria-hidden className="text-lg leading-none">
                    {c.emoji || "📦"}
                  </span>
                  {c.name}
                  <span className={cx("rounded-full px-1.5 text-[11px]", active ? "bg-butter" : "bg-card/70")}>{c.counts.models}</span>
                </button>
              );
            })}
          </div>

          {category && (
            <div className="mb-3 flex items-center justify-between gap-2 px-1 text-[12px] text-ink-soft">
              <span>
                브랜드 {category.counts.brands} · 모델 {category.counts.models} · 매장 {category.counts.stores}
              </span>
              <Link href={`/research/${category.id}`} className="inline-flex items-center gap-1 font-bold text-[#5b4bd6]">
                <BookOpen aria-hidden className="h-3.5 w-3.5" /> 조사 보고서
              </Link>
            </div>
          )}

          {/* Kind chips + filter toggle */}
          <div className="no-scrollbar -mx-4 mb-2 flex items-center gap-1.5 overflow-x-auto px-4 pb-1">
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
              className={cx(
                "flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1 text-[13px] font-semibold",
                showFilters || activeFilterCount ? "border-ink bg-butter text-ink" : "border-line bg-card text-ink-soft",
              )}
            >
              <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" /> 필터{activeFilterCount ? ` ${activeFilterCount}` : ""}
            </button>
            <Chip active={!kind} onClick={() => setParam({ kind: "" })}>
              전체
            </Chip>
            {[...(category?.product_kinds ?? [])].sort((a, b) => PRODUCT_KIND_ORDER.indexOf(a) - PRODUCT_KIND_ORDER.indexOf(b)).map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setParam({ kind: kind === k ? "" : k })}>
                {PRODUCT_KIND[k]}
              </Chip>
            ))}
          </div>

          {showFilters && (
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-3xl border-2 border-line bg-card/80 p-2.5">
              <Select label="브랜드" value={brand} onChange={(v) => setParam({ brand: v })}>
                <option value="">브랜드 전체</option>
                {brands?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.model_count})
                  </option>
                ))}
              </Select>
              <Select label="가격대 (대표가 기준)" value={price} onChange={(v) => setParam({ price: v })}>
                {PRICE_RANGES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
              <Select label="내 도장 상태" value={stage} onChange={(v) => setParam({ stage: v })}>
                <option value="">도장 전체</option>
                <option value="any">도장 있는 모델</option>
                <option value="none">아직 도장 없음</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE[s].label}
                  </option>
                ))}
              </Select>
              <Select label="정렬" value={sort} onChange={(v) => setParam({ sort: v === "default" ? "" : v })}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <p className="col-span-2 px-1 text-[11px] leading-snug text-ink-faint">
                가격대는 카드의 대표가 기준이에요. 대표가의 옵션(사이즈)은 모델마다 다를 수 있고, 가격 미확인 모델은 가격 필터에서 빠져요.
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setParam({ kind: "", brand: "", price: "", stage: "", sort: "", q: "" });
                  }}
                  className="col-span-2 rounded-2xl py-1.5 text-xs font-bold text-stamp"
                >
                  필터 모두 지우기
                </button>
              )}
            </div>
          )}

          {/* Results */}
          {modelError ? (
            <ErrorState error={modelError} onRetry={() => retryModels()} />
          ) : modelsLoading && !models ? (
            <LoadingList />
          ) : !models || models.total === 0 ? (
            category && category.counts.models === 0 ? (
              <EmptyState title={`${category.name} 모델은 아직 조사 중이에요`} emoji="🔎">
                조사 자료가 들어오면 이곳에 카드가 생겨요. 가짜 정보는 채우지 않아요.
              </EmptyState>
            ) : (
              <EmptyState title="조건에 맞는 모델이 없어요" emoji="🫥">
                필터를 줄이거나 다른 검색어를 입력해 보세요.
              </EmptyState>
            )
          ) : (
            <>
              <p className="mb-2 px-1 text-[12px] font-semibold text-ink-soft">모델 {models.total}개</p>
              {grouped ? (
                <div className="space-y-5">
                  {grouped.map((g) => (
                    <section key={g.brandId} aria-labelledby={`brand-${g.brandId}`}>
                      <div className="mb-2 flex items-center justify-between px-1">
                        <h2 id={`brand-${g.brandId}`} className="font-display text-base">
                          {g.name}
                        </h2>
                        <Link href={`/brands/${g.brandId}`} className="text-[12px] font-bold text-[#5b4bd6]">
                          브랜드 보고서 →
                        </Link>
                      </div>
                      <ul className="space-y-3">
                        {g.items.map((m) => (
                          <li key={m.id}>
                            <ModelCard model={m} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : (
                <ul className="space-y-3">
                  {models.items.map((m) => (
                    <li key={m.id}>
                      <ModelCard model={m} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
