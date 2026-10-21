"use client";

import { Eraser, ExternalLink as ExternalIcon, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { CompareButton } from "@/components/CompareButton";
import { Markdown } from "@/components/Markdown";
import { NoteForm } from "@/components/NoteForm";
import { PageHeader } from "@/components/PageHeader";
import { PriceTable, PriceTag } from "@/components/Price";
import { ProductImage } from "@/components/ProductImage";
import { ReviewCard } from "@/components/ReviewCard";
import { SampleBanner } from "@/components/SampleBanner";
import { SourceLink } from "@/components/SourceLink";
import { StampTrack, emptyStamps } from "@/components/Stamp";
import { StoreCard } from "@/components/StoreCard";
import { toast } from "@/components/toast";
import { Badge, Card, EmptyState, ErrorState, LoadingList, SectionTitle, cx } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatDate, formatSpecValue } from "@/lib/format";
import { useProgress } from "@/lib/hooks";
import { ENTITY_STATUS, PRODUCT_KIND, REVIEW_BUCKET, STAGE } from "@/lib/labels";
import type { Claim, ModelDetail, Review, Stage } from "@/lib/types";

const TABS = [
  { id: "summary", label: "핵심 요약" },
  { id: "pros", label: "장점" },
  { id: "cons", label: "단점·주의" },
  { id: "reviews", label: "내돈내산 후기" },
  { id: "as", label: "A/S" },
  { id: "sources", label: "출처" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function ClaimList({ claims, tone, empty }: { claims: Claim[]; tone: "ok" | "stamp"; empty: string }) {
  if (!claims.length) return <EmptyState title={empty} emoji="🗒️" />;
  return (
    <ul className="space-y-2">
      {claims.map((c, i) => (
        <li key={i} className="rounded-2xl border-2 border-line bg-card px-3 py-2.5">
          <p className="flex gap-2 text-sm leading-relaxed">
            <span aria-hidden className={cx("mt-0.5 font-display", tone === "ok" ? "text-ok" : "text-stamp")}>
              {tone === "ok" ? "＋" : "！"}
            </span>
            <span>{c.text}</span>
          </p>
          <div className="mt-1 pl-6">
            <SourceLink url={c.source_url} sourceType={c.source_type} checkedAt={c.checked_at} linkStatus={c.link_status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ModelDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: m, error, isLoading, mutate } = useSWR<ModelDetail>(`/api/models/${id}`);
  const { data: progress, setStage } = useProgress();
  const [tab, setTab] = useState<TabId>("summary");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<Stage | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);

  const myProgress = progress?.models.find((p) => p.model_id === id);
  const current = myProgress?.stage ?? null;
  const stamps = myProgress?.stamps ?? emptyStamps(current);

  const buckets = useMemo(() => {
    const by = { experience: [], purchase_reference: [], community: [], excluded: [] } as Record<Review["bucket"], Review[]>;
    for (const r of m?.reviews ?? []) by[r.bucket].push(r);
    return by;
  }, [m]);
  const independent = buckets.experience;

  if (error) {
    return (
      <div className="pt-3">
        <PageHeader title="모델 상세" />
        {error instanceof ApiError && error.status === 404 ? (
          <EmptyState title="이 모델을 찾을 수 없어요" emoji="🕳️">
            조사 자료에서 빠졌거나 id가 바뀌었을 수 있어요. 내 도장 기록은 그대로 남아 있어요.
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={() => mutate()} />
        )}
      </div>
    );
  }
  if (isLoading || !m) {
    return (
      <div className="pt-3">
        <PageHeader title="모델 상세" />
        <LoadingList count={4} />
      </div>
    );
  }

  const stampTo = async (stage: Stage) => {
    setBusy(true);
    try {
      await setStage(m.id, stage);
      setFresh(stage);
      toast(`${STAGE[stage].emoji} ${STAGE[stage].label} 도장 꾹!`);
    } catch (e) {
      toast(`저장 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };
  const clearStamps = async () => {
    setBusy(true);
    try {
      await setStage(m.id, null);
      setFresh(null);
      toast("이 모델의 도장을 지웠어요");
    } finally {
      setBusy(false);
    }
  };

  const gallery = m.gallery.length ? m.gallery : [m.image];
  const shown = gallery[Math.min(galleryIdx, gallery.length - 1)];

  return (
    <div className="pt-3">
      <PageHeader title={m.name} sub={m.brand?.name ?? "브랜드 미확인"} right={<CompareButton model={m} />} />
      <SampleBanner />

      {/* Gallery */}
      <Card className="overflow-hidden">
        <ProductImage image={shown} kind={m.product_kind} className="aspect-[4/3] w-full" showReason />
        {gallery.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto border-t-2 border-line p-2">
            {gallery.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setGalleryIdx(i)}
                aria-label={`사진 ${i + 1}`}
                aria-pressed={i === galleryIdx}
                className={cx("shrink-0 overflow-hidden rounded-xl border-2", i === galleryIdx ? "border-ink" : "border-line")}
              >
                <ProductImage image={g} kind={m.product_kind} className="h-14 w-14" />
              </button>
            ))}
          </div>
        )}
        {!shown.display_url && shown.image_source_url && (
          <a
            href={shown.image_source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 border-t-2 border-line py-2 text-xs font-bold text-[#5b4bd6]"
          >
            공식 페이지에서 실제 사진 보기 <ExternalIcon aria-hidden className="h-3 w-3" />
          </a>
        )}
      </Card>

      {/* Identity */}
      <section className="mt-4 px-1">
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone={m.product_kind === "mattress" ? "lilac" : m.product_kind === "bed_frame" ? "peach" : "sky"}>{PRODUCT_KIND[m.product_kind]}</Badge>
          <Badge tone={m.status === "verified" ? "ok" : "neutral"}>{ENTITY_STATUS[m.status]}</Badge>
          {m.category_name && <Badge tone="butter">{m.category_name}</Badge>}
        </div>
        {m.brand && (
          <Link href={`/brands/${m.brand.id}`} className="mt-2 inline-block text-sm font-bold text-ink-soft hover:underline">
            {m.brand.name}
            {m.brand.name_en ? ` · ${m.brand.name_en}` : ""} →
          </Link>
        )}
        <h2 className="font-display text-2xl leading-tight">{m.name}</h2>
        <p className="mt-1 text-[11px] text-ink-faint">
          {m.model_code ? `모델코드 ${m.model_code} · ` : ""}조사 갱신 {formatDate(m.updated_at)}
          {m.last_verified_at ? ` · 마지막 검증 ${formatDate(m.last_verified_at)}` : ""}
        </p>
      </section>

      <Card className="mt-3 p-3">
        <p className="mb-1 text-[11px] font-bold text-ink-soft">대표 가격</p>
        <PriceTag price={m.representative_price} />
      </Card>

      {/* My stamps */}
      <SectionTitle
        right={
          current && (
            <button type="button" onClick={clearStamps} disabled={busy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-faint">
              <Eraser aria-hidden className="h-3.5 w-3.5" /> 도장 지우기
            </button>
          )
        }
      >
        내 도장
      </SectionTitle>
      <Card className="bg-[#fffaf3] p-3">
        <StampTrack stamps={stamps} current={current} onSelect={stampTo} busy={busy} freshStage={fresh} />
        <p className="mt-2 text-center text-[11px] text-ink-faint">
          {current ? `지금은 '${STAGE[current].label}' 단계예요. 다음 도장을 눌러 진행해요.` : "도장을 눌러 진행 단계를 기록해요."}
        </p>
      </Card>

      {/* Prices */}
      <SectionTitle>옵션별 가격</SectionTitle>
      <PriceTable groups={m.price_table} />

      {/* Specs */}
      <SectionTitle>사양</SectionTitle>
      {m.specs.length ? (
        <Card className="overflow-hidden">
          <dl className="divide-y divide-line">
            {m.specs.map((s) => (
              <div key={s.key} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-2 text-sm">
                <dt className="font-semibold text-ink-soft">{s.label}</dt>
                <dd className={cx("min-w-0 break-words", s.value_label === "미확인" && "text-ink-faint")}>
                  {s.value_label ?? formatSpecValue(s.value, s.unit)}
                  {s.value_label && s.value_label !== "미확인" && <span className="ml-1 text-[11px] text-ink-faint">({String(s.value)})</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : (
        <EmptyState title="확인된 사양이 아직 없어요" emoji="📐" />
      )}

      {/* Tabs required by the brief */}
      <div role="tablist" aria-label="상세 정보" className="no-scrollbar sticky top-[58px] z-20 -mx-4 mt-6 flex gap-1.5 overflow-x-auto bg-paper/95 px-4 py-2 backdrop-blur">
        {TABS.map((t) => {
          const count =
            t.id === "pros" ? m.pros.length : t.id === "cons" ? m.cons.length : t.id === "reviews" ? independent.length : t.id === "sources" ? m.sources.length : null;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cx(
                "shrink-0 rounded-full border-2 px-3 py-1.5 text-[13px] font-bold",
                tab === t.id ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-soft",
              )}
            >
              {t.label}
              {count !== null && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-2">
        {tab === "summary" && (
          <Card className="px-4 py-3">
            <Markdown>{m.body_md}</Markdown>
            <p className="mt-3 break-all border-t-2 border-dashed border-line pt-2 text-[10px] text-ink-faint">원본: research/{m.source_path}</p>
          </Card>
        )}
        {tab === "pros" && <ClaimList claims={m.pros} tone="ok" empty="근거가 확인된 장점이 아직 없어요" />}
        {tab === "cons" && <ClaimList claims={m.cons} tone="stamp" empty="확인된 단점·주의사항이 아직 없어요" />}
        {tab === "reviews" && (
          <div className="space-y-2">
            <div className="rounded-2xl bg-mint/60 px-3 py-2 text-xs leading-relaxed">
              독립 후기 <b>{m.review_stats.independent}</b>건 (긍정 {m.review_stats.positive} · 부정 {m.review_stats.negative} · 혼합 {m.review_stats.mixed})
              {m.review_stats.excluded > 0 && <> · 집계 제외 {m.review_stats.excluded}건</>}
              <p className="mt-0.5 text-[11px] text-ink-soft">
                원문 URL·게시일·구매/사용 진술이 있고 협찬이 아닌 글만 집계해요. &lsquo;내돈내산&rsquo; 표기만으로 구매 인증으로 보지 않아요.
              </p>
            </div>
            {m.review_stats.purchase_proof > 0 && (
              <p className="px-1 text-[11px] font-semibold text-ok">구매 증빙이 확인된 글 {m.review_stats.purchase_proof}건 (증빙이 무보상을 뜻하지는 않아요)</p>
            )}
            {independent.length ? independent.map((r) => <ReviewCard key={r.id} review={r} />) : <EmptyState title="집계 가능한 독립 후기가 아직 없어요" emoji="💬" />}
            {(["purchase_reference", "community"] as const).map(
              (b) =>
                buckets[b].length > 0 && (
                  <div key={b} className="space-y-2 pt-2">
                    <p className="px-1 text-xs font-bold text-ink-soft">
                      {REVIEW_BUCKET[b]} {buckets[b].length}건 <span className="font-normal text-ink-faint">· 실사용 집계에는 넣지 않아요</span>
                    </p>
                    {buckets[b].map((r) => (
                      <ReviewCard key={r.id} review={r} />
                    ))}
                  </div>
                ),
            )}
            {buckets.excluded.length > 0 && (
              <button type="button" onClick={() => setShowExcluded((s) => !s)} aria-expanded={showExcluded} className="w-full rounded-2xl py-2 text-xs font-bold text-ink-soft">
                집계 제외 글 {buckets.excluded.length}건 {showExcluded ? "숨기기" : "보기"}
              </button>
            )}
            {showExcluded && buckets.excluded.map((r) => <ReviewCard key={r.id} review={r} />)}
            {m.brand_reviews.length > 0 && (
              <>
                <p className="px-1 pt-3 text-xs font-bold text-ink-soft">같은 브랜드 전반 후기 (이 모델 집계에는 포함하지 않음)</p>
                {m.brand_reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} showModel />
                ))}
              </>
            )}
          </div>
        )}
        {tab === "as" && (
          <Card className="p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
              <div className="min-w-0">
                <p className="text-sm font-bold">보증 · A/S</p>
                <p className="mt-1 text-sm leading-relaxed">{m.warranty_summary || <span className="text-ink-faint">보증·A/S 정보가 아직 확인되지 않았어요.</span>}</p>
                <div className="mt-2">
                  <SourceLink url={m.warranty_source_url} linkStatus={m.warranty_link.link_status} />
                </div>
                <p className="mt-3 text-[11px] leading-snug text-ink-faint">
                  보증 부위·소비자 부담·예외 조항은 구매 전에 매장과 공식 정책에서 다시 확인하세요. 자세한 조사 내용은 &lsquo;핵심 요약&rsquo;의 보증 및 A/S 항목을 참고하세요.
                </p>
              </div>
            </div>
          </Card>
        )}
        {tab === "sources" && (
          <Card className="p-3">
            {m.sources.length ? (
              <ul className="space-y-2">
                {m.sources.map((s, i) => (
                  <li key={i} className="border-b border-dashed border-line pb-2 last:border-0 last:pb-0">
                    <SourceLink url={s.url} title={s.title} sourceType={s.source_type} checkedAt={s.checked_at} linkStatus={s.link_status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-faint">등록된 출처가 없어요.</p>
            )}
            <p className="mt-3 text-[11px] text-ink-faint">가격·장단점·후기의 개별 출처는 각 항목 옆에 표시돼요.</p>
          </Card>
        )}
      </div>

      {/* Stores */}
      <SectionTitle right={<Link href={`/map?model=${m.id}`} className="text-[12px] font-bold text-[#5b4bd6]">지도에서 보기 →</Link>}>
        실물 체험 매장
      </SectionTitle>
      <p className="mb-2 px-1 text-[11px] leading-snug text-ink-faint">
        &lsquo;취급 매장&rsquo;은 브랜드 매장일 뿐 이 모델의 전시를 뜻하지 않아요. 방문 전 전화로 전시 여부를 확인하세요.
      </p>
      {m.stores.length ? (
        <div className="space-y-2">
          {m.stores.map((s) => (
            <StoreCard key={s.id} store={s} />
          ))}
        </div>
      ) : (
        <EmptyState title="연결된 매장 정보가 아직 없어요" emoji="🏬" />
      )}

      {/* Compatibility */}
      <SectionTitle>호환 확인된 조합</SectionTitle>
      {m.compatibility.length ? (
        <ul className="space-y-2">
          {m.compatibility.map((c) => (
            <li key={c.model_id} className="rounded-2xl border-2 border-line bg-card p-3">
              <Link href={`/models/${c.model_id}`} className="text-sm font-bold hover:underline">
                {c.brand_name ? `${c.brand_name} · ` : ""}
                {c.name}
              </Link>
              <p className="text-[11px] text-ink-soft">
                {PRODUCT_KIND[c.product_kind]} · 호환 규격 {c.sizes.join(", ") || "미기재"}
                {c.verified_at && ` · 확인 ${formatDate(c.verified_at)}`}
              </p>
              {c.note && <p className="mt-0.5 text-[11px] text-ink-faint">{c.note}</p>}
              <div className="mt-1">
                <SourceLink url={c.source_url} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-muted-soft px-3 py-2.5 text-xs text-ink-soft">
          출처로 호환이 확인된 조합이 아직 없어요. 매트리스·프레임 규격이 맞는지 직접 확인하세요.
        </p>
      )}

      {/* Personal record */}
      <SectionTitle>내 기록</SectionTitle>
      <Card className="p-3">
        <NoteForm modelId={m.id} />
      </Card>
    </div>
  );
}
