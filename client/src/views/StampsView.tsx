"use client";

import Link from "next/link";
import useSWR from "swr";

import { PageHeader } from "@/components/PageHeader";
import { StampMark, StampTrack } from "@/components/Stamp";
import { Badge, Card, EmptyState, ErrorState, LoadingList, SectionTitle } from "@/components/ui";
import { formatDate, formatKRW } from "@/lib/format";
import { useProgress } from "@/lib/hooks";
import { PRODUCT_KIND, STAGE, STAGES } from "@/lib/labels";
import type { Category, PersonalNote, ProgressEvent } from "@/lib/types";

function eventText(e: ProgressEvent) {
  const name = e.target_name ?? `${e.target_id} (조사 자료에서 빠짐)`;
  if (e.stage === "cleared") return `${name} 도장 지움`;
  if (e.stage === "visited") return `${name} 방문 도장`;
  return `${name} · ${STAGE[e.stage].label}`;
}

export function StampsView() {
  const { data: progress, error, mutate, isLoading } = useProgress();
  const { data: categories } = useSWR<Category[]>("/api/categories");
  const { data: notes } = useSWR<{ items: PersonalNote[] }>("/api/personal-notes");

  if (error) {
    return (
      <div className="pt-3">
        <PageHeader title="내 도장" back={false} />
        <ErrorState error={error} onRetry={() => mutate()} />
      </div>
    );
  }
  if (isLoading || !progress) {
    return (
      <div className="pt-3">
        <PageHeader title="내 도장" back={false} />
        <LoadingList />
      </div>
    );
  }

  const totalStamps = progress.models.reduce((n, m) => n + m.stage_index + 1, 0) + progress.stores.length;
  const purchased = progress.models.filter((m) => m.stage === "purchased").length;
  const quotes = (notes?.items ?? []).flatMap((n) => n.quotes.map((q) => ({ ...q, model_id: n.model_id, model_name: n.model_name, orphaned: n.orphaned })));
  const rated = (notes?.items ?? []).filter((n) => n.rating);

  return (
    <div className="pt-3">
      <PageHeader title="내 도장" back={false} sub="찜부터 구매까지, 우리 집 스탬프북" />

      {/* Cover */}
      <section className="relative overflow-hidden rounded-[28px] border-2 border-line-strong bg-pink/70 p-4 shadow-sticker">
        <div aria-hidden className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-butter" />
        <p className="relative text-xs font-bold text-[#a43d64]">우리 집 스탬프북</p>
        <div className="relative mt-2 flex items-end gap-4">
          <div>
            <p className="font-display text-4xl leading-none">{totalStamps}</p>
            <p className="text-[11px] font-semibold text-ink-soft">모은 도장</p>
          </div>
          <div>
            <p className="font-display text-2xl leading-none">{progress.stores.length}</p>
            <p className="text-[11px] font-semibold text-ink-soft">방문한 매장</p>
          </div>
          <div>
            <p className="font-display text-2xl leading-none">{purchased}</p>
            <p className="text-[11px] font-semibold text-ink-soft">구매 완료</p>
          </div>
          <div className="ml-auto">
            <StampMark label={purchased ? "완성!" : "도전"} sub={purchased ? `${purchased}개 구매` : "진행 중"} size="lg" inked={purchased > 0} />
          </div>
        </div>
      </section>

      {/* Per category */}
      <SectionTitle>카테고리별 진행률</SectionTitle>
      {categories?.length ? (
        <div className="space-y-2">
          {categories.map((c) => {
            const mine = progress.models.filter((m) => m.category_id === c.id);
            const byStage = STAGES.map((s) => mine.filter((m) => m.stage === s).length);
            const done = mine.some((m) => m.stage === "purchased");
            // Progress = furthest stage reached in this category (찜 20% … 구매 100%).
            const furthest = mine.reduce((mx, m) => Math.max(mx, m.stage_index + 1), 0);
            const pct = Math.round((furthest / STAGES.length) * 100);
            return (
              <Card key={c.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold">
                    <span aria-hidden className="mr-1">
                      {c.emoji ?? "📦"}
                    </span>
                    {c.name}
                  </p>
                  {done ? <Badge tone="stamp">구매 완료 🎉</Badge> : <span className="text-[11px] text-ink-faint">모델 {c.counts.models}개 중 {mine.length}개 도장</span>}
                </div>
                <div
                  className="mt-2 h-3 overflow-hidden rounded-full border-2 border-line bg-paper-deep"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${c.name} 진행률`}
                >
                  <div className="h-full rounded-full bg-stamp/80 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[10px] text-ink-soft">
                  {STAGES.map((s, i) => (
                    <div key={s} className={byStage[i] ? "font-bold text-ink" : undefined}>
                      {STAGE[s].emoji}
                      <br />
                      {STAGE[s].short} {byStage[i]}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="px-1 text-sm text-ink-faint">카테고리 정보가 없어요.</p>
      )}

      {/* Stamp book */}
      <SectionTitle>모델 도장</SectionTitle>
      {progress.models.length ? (
        <div className="space-y-2">
          {progress.models.map((m) => (
            <Card key={m.model_id} className="p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-ink-soft">
                    {m.brand_name ?? ""} {m.product_kind ? `· ${PRODUCT_KIND[m.product_kind]}` : ""}
                  </p>
                  {m.orphaned ? (
                    <p className="text-sm font-bold text-ink-soft">
                      {m.model_id} <Badge tone="warn">조사 자료에서 빠짐 · 기록 보존</Badge>
                    </p>
                  ) : (
                    <Link href={`/models/${m.model_id}`} className="text-sm font-bold hover:underline">
                      {m.model_name}
                    </Link>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-ink-faint">{formatDate(m.updated_at)}</span>
              </div>
              <StampTrack stamps={m.stamps} current={m.stage} />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="아직 찍은 도장이 없어요" emoji="💮">
          도감에서 마음에 드는 모델의 하트를 눌러 첫 도장을 찍어 보세요.
        </EmptyState>
      )}

      {/* Store visits */}
      <SectionTitle right={<Link href="/map" className="text-[12px] font-bold text-[#5b4bd6]">지도 →</Link>}>방문 도장</SectionTitle>
      {progress.stores.length ? (
        <div className="grid grid-cols-2 gap-2">
          {progress.stores.map((s, i) => (
            <Card key={s.store_id} className="flex items-center gap-2 p-2.5">
              <StampMark size="sm" label="방문" tilt={[-8, 6, -4, 9][i % 4]} />
              <div className="min-w-0">
                {s.orphaned ? (
                  <p className="truncate text-xs font-bold text-ink-soft">{s.store_id}</p>
                ) : (
                  <Link href={`/stores/${s.store_id}`} className="line-clamp-2 text-xs font-bold leading-tight hover:underline">
                    {s.store_name}
                  </Link>
                )}
                <p className="text-[10px] text-ink-faint">{s.visited_on ? formatDate(s.visited_on) : "날짜 없음"}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-muted-soft px-3 py-2.5 text-xs text-ink-soft">매장을 다녀오면 매장 카드의 &lsquo;방문 도장&rsquo;을 눌러 기록해요.</p>
      )}

      {/* Quotes & ratings */}
      <SectionTitle>내가 받은 견적 · 평점</SectionTitle>
      {quotes.length || rated.length ? (
        <Card className="divide-y divide-line">
          {rated.map((n) => (
            <div key={`r-${n.model_id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <Link href={`/models/${n.model_id}`} className="min-w-0 truncate font-semibold hover:underline">
                {n.model_name ?? n.model_id}
              </Link>
              <span className="shrink-0 text-[#e6a817]" aria-label={`${n.rating}점`}>
                {"★".repeat(n.rating!)}
                <span className="text-line-strong">{"★".repeat(5 - n.rating!)}</span>
              </span>
            </div>
          ))}
          {quotes.map((q, i) => (
            <div key={`q-${i}`} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/models/${q.model_id}`} className="min-w-0 truncate text-sm font-semibold hover:underline">
                  {q.model_name ?? q.model_id}
                </Link>
                <span className="shrink-0 font-extrabold">{formatKRW(q.amount_krw)}</span>
              </div>
              <p className="text-[11px] text-ink-soft">
                {q.size_or_option || "옵션 미기재"} · {q.quoted_on ? formatDate(q.quoted_on) : "날짜 없음"}
                {q.place && ` · ${q.place}`}
              </p>
            </div>
          ))}
          <p className="px-3 py-2 text-[10px] text-ink-faint">개인 견적은 조사된 공식 가격과 따로 저장돼요.</p>
        </Card>
      ) : (
        <p className="rounded-2xl bg-muted-soft px-3 py-2.5 text-xs text-ink-soft">모델 상세의 &lsquo;내 기록&rsquo;에서 견적과 평점을 남길 수 있어요.</p>
      )}

      {/* Timeline */}
      {progress.events.length > 0 && (
        <>
          <SectionTitle>최근 기록</SectionTitle>
          <ol className="space-y-1.5 border-l-2 border-dashed border-line-strong pl-4">
            {progress.events.slice(0, 15).map((e) => (
              <li key={e.id} className="relative text-xs">
                <span aria-hidden className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border-2 border-stamp bg-card" />
                <span className="text-ink-faint">{formatDate(e.created_at)}</span> {eventText(e)}
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="mt-8 text-center text-[11px] text-ink-faint">
        <Link href="/data-report" className="underline underline-offset-2">
          데이터 검증 리포트
        </Link>
      </p>
    </div>
  );
}
