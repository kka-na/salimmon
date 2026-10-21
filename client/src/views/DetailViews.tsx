"use client";

// Smaller read-only pages: store, brand, review, research report and the validation report.

import { AlertTriangle, Info, Phone, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { Markdown } from "@/components/Markdown";
import { ModelCard } from "@/components/ModelCard";
import { PageHeader } from "@/components/PageHeader";
import { ReviewCard } from "@/components/ReviewCard";
import { SampleBanner } from "@/components/SampleBanner";
import { SourceLink } from "@/components/SourceLink";
import { DisplayStatusBadge, VisitButton, directionLinks } from "@/components/StoreCard";
import { Badge, Card, Chip, EmptyState, ErrorState, LoadingList, SectionTitle, cx } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ENTITY_STATUS, PRODUCT_KIND } from "@/lib/labels";
import type { BrandDetail, Issue, ResearchReport, Review, StoreDetail, ValidationReport } from "@/lib/types";

function Fallback({ title, error, retry }: { title: string; error: unknown; retry: () => void }) {
  return (
    <div className="pt-3">
      <PageHeader title={title} />
      {error ? (
        error instanceof ApiError && error.status === 404 ? (
          <EmptyState title="자료를 찾을 수 없어요" emoji="🕳️">
            조사 자료에서 빠졌거나 id가 바뀌었을 수 있어요.
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={retry} />
        )
      ) : (
        <LoadingList count={3} />
      )}
    </div>
  );
}

export function StoreDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: s, error, mutate } = useSWR<StoreDetail>(`/api/stores/${id}`);
  if (!s) return <Fallback title="매장" error={error} retry={() => mutate()} />;
  return (
    <div className="pt-3">
      <PageHeader title={s.name} sub={s.brands.map((b) => b.name).join(" · ")} />
      <SampleBanner />
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-1">
          <DisplayStatusBadge store={s} />
          <Badge>{ENTITY_STATUS[s.status]}</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1.5 text-sm">
          <dt className="font-semibold text-ink-soft">주소</dt>
          <dd>{s.address || <span className="text-ink-faint">미확인</span>}</dd>
          <dt className="font-semibold text-ink-soft">전화</dt>
          <dd>
            {s.phone ? (
              <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                <Phone aria-hidden className="h-3.5 w-3.5" /> {s.phone}
              </a>
            ) : (
              <span className="text-ink-faint">미확인</span>
            )}
          </dd>
          {s.hours && (
            <>
              <dt className="font-semibold text-ink-soft">영업</dt>
              <dd>{s.hours}</dd>
            </>
          )}
          <dt className="font-semibold text-ink-soft">좌표</dt>
          <dd className="text-xs">{s.has_verified_coords ? `${s.lat}, ${s.lng} (조사 확인)` : <span className="text-ink-faint">검증 좌표 없음 · 지도는 주소 검색으로 표시</span>}</dd>
          <dt className="font-semibold text-ink-soft">확인일</dt>
          <dd>{s.verified_at ? formatDate(s.verified_at) : <span className="text-ink-faint">없음</span>}</dd>
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {directionLinks(s).map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="rounded-full border-2 border-line bg-card px-3 py-1 text-xs font-semibold">
              {l.label}
            </a>
          ))}
          {s.official_store_url && (
            <a href={s.official_store_url} target="_blank" rel="noopener noreferrer" className="rounded-full border-2 border-line bg-card px-3 py-1 text-xs font-semibold">
              공식 매장 안내
            </a>
          )}
        </div>
        <div className="mt-3">
          <VisitButton storeId={s.id} name={s.name} />
        </div>
      </Card>

      <SectionTitle>실물 전시가 확인된 모델</SectionTitle>
      {s.models_on_display.length ? (
        <ul className="space-y-2">
          {s.models_on_display.map((m) => (
            <li key={m.id}>
              <Link href={`/models/${m.id}`} className="flex items-center justify-between rounded-2xl border-2 border-line bg-card px-3 py-2.5 text-sm font-bold">
                {m.name} <Badge tone="ok">{PRODUCT_KIND[m.product_kind]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-muted-soft px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
          이 매장에서 특정 모델의 전시가 확인된 기록은 아직 없어요. 방문 전에 전화로 원하는 모델·사이즈·경도의 전시 여부를 확인하세요.
        </p>
      )}

      {s.linked_models.length > 0 && (
        <>
          <SectionTitle>이 매장과 연결된 모델 (전시 미확인)</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {s.linked_models.map((m) => (
              <Link key={m.id} href={`/models/${m.id}`} className="rounded-full border-2 border-dashed border-line-strong bg-card px-3 py-1 text-xs font-semibold text-ink-soft">
                {m.name}
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionTitle>출처</SectionTitle>
      <Card className="p-3">
        {s.sources.length ? (
          <ul className="space-y-1.5">
            {s.sources.map((src, i) => (
              <li key={i}>
                <SourceLink url={src.url} title={src.title} sourceType={src.source_type} checkedAt={src.checked_at} linkStatus={src.link_status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-faint">등록된 출처가 없어요.</p>
        )}
      </Card>

      <SectionTitle>매장 조사 기록</SectionTitle>
      <Card className="px-4 py-3">
        <Markdown>{s.body_md}</Markdown>
      </Card>
    </div>
  );
}

export function BrandDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: b, error, mutate } = useSWR<BrandDetail>(`/api/brands/${id}`);
  const { data: reviews } = useSWR<{ items: Review[] }>(`/api/reviews?brand_id=${encodeURIComponent(id)}&include_excluded=true`);
  if (!b) return <Fallback title="브랜드" error={error} retry={() => mutate()} />;
  return (
    <div className="pt-3">
      <PageHeader title={b.name} sub={b.name_en ?? undefined} />
      <SampleBanner />
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-1">
          <Badge>{ENTITY_STATUS[b.status]}</Badge>
          <Badge tone="butter">모델 {b.model_count}</Badge>
          <span className="text-[11px] text-ink-faint">갱신 {formatDate(b.updated_at)}</span>
        </div>
        {b.official_url && (
          <div className="mt-2">
            <SourceLink url={b.official_url} title="공식 사이트" sourceType="official" />
          </div>
        )}
      </Card>
      <SectionTitle>모델</SectionTitle>
      {b.models.length ? (
        <ul className="space-y-3">
          {b.models.map((m) => (
            <li key={m.id}>
              <ModelCard model={m} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="등록된 모델이 아직 없어요" emoji="🔎" />
      )}
      {reviews && reviews.items.length > 0 && (
        <>
          <SectionTitle>이 브랜드의 후기 기록</SectionTitle>
          <div className="space-y-2">
            {reviews.items.map((r) => (
              <ReviewCard key={r.id} review={r} showModel />
            ))}
          </div>
        </>
      )}
      <SectionTitle>브랜드 조사 보고서</SectionTitle>
      <Card className="px-4 py-3">
        <Markdown>{b.body_md}</Markdown>
      </Card>
    </div>
  );
}

export function ReviewDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: r, error, mutate } = useSWR<Review>(`/api/reviews/${id}`);
  if (!r) return <Fallback title="후기" error={error} retry={() => mutate()} />;
  return (
    <div className="pt-3">
      <PageHeader title={r.title || "후기 기록"} sub={[r.brand_name, r.model_name].filter(Boolean).join(" · ") || undefined} />
      <ReviewCard review={{ ...r, body_md: undefined }} showModel />
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        {r.model_id && (
          <Link href={`/models/${r.model_id}`} className="rounded-full border-2 border-line bg-card px-3 py-1">
            모델 보기 →
          </Link>
        )}
        {r.brand_id && (
          <Link href={`/brands/${r.brand_id}`} className="rounded-full border-2 border-line bg-card px-3 py-1">
            브랜드 보기 →
          </Link>
        )}
      </div>
      <SectionTitle>조사 메모</SectionTitle>
      <Card className="px-4 py-3">
        <Markdown>{r.body_md ?? ""}</Markdown>
      </Card>
    </div>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  const icon = { error: XCircle, warning: AlertTriangle, info: Info };
  const tone = { error: "text-stamp", warning: "text-warn", info: "text-[#2d5f96]" };
  return (
    <ul className="space-y-1.5">
      {issues.map((i, n) => {
        const Icon = icon[i.severity];
        return (
          <li key={n} className="flex gap-2 rounded-2xl border-2 border-line bg-card px-3 py-2 text-xs">
            <Icon aria-label={i.severity} className={cx("mt-0.5 h-4 w-4 shrink-0", tone[i.severity])} />
            <div className="min-w-0">
              <p className="break-all font-mono text-[11px] text-ink-soft">
                {i.path} · <b>{i.field}</b>
              </p>
              <p className="mt-0.5 leading-snug">{i.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ResearchReportView() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const { data: r, error, mutate } = useSWR<ResearchReport>(`/api/research/${categoryId}`);
  const [brandOpen, setBrandOpen] = useState<string | null>(null);
  if (!r) return <Fallback title="조사 보고서" error={error} retry={() => mutate()} />;
  const problems = r.issues.filter((i) => i.severity !== "info");
  return (
    <div className="pt-3">
      <PageHeader title={`${r.category.emoji ?? ""} ${r.category.name} 조사 보고서`} sub={`갱신 ${formatDate(r.category.updated_at)} · ${ENTITY_STATUS[r.category.status]}`} />
      <SampleBanner />
      <Card className="px-4 py-3">
        <Markdown>{r.category.body_md}</Markdown>
      </Card>

      <SectionTitle>브랜드별 보고서</SectionTitle>
      {r.brands.length ? (
        <div className="space-y-2">
          {r.brands.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setBrandOpen(brandOpen === b.id ? null : b.id)}
                aria-expanded={brandOpen === b.id}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-bold">{b.name}</span>
                <span className="text-[11px] text-ink-faint">
                  {ENTITY_STATUS[b.status]} · {brandOpen === b.id ? "접기" : "펼치기"}
                </span>
              </button>
              {brandOpen === b.id && (
                <div className="border-t-2 border-dashed border-line px-4 py-2">
                  <Markdown>{b.body_md}</Markdown>
                  <Link href={`/brands/${b.id}`} className="mt-2 inline-block text-xs font-bold text-[#5b4bd6]">
                    브랜드 모델 보기 →
                  </Link>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="브랜드 보고서가 아직 없어요" emoji="📄" />
      )}

      {problems.length > 0 && (
        <>
          <SectionTitle>이 카테고리의 데이터 검증 경고</SectionTitle>
          <IssueList issues={problems} />
        </>
      )}
    </div>
  );
}

export function DataReportView() {
  const { data: r, error, mutate } = useSWR<ValidationReport>("/api/validation-report");
  const [sev, setSev] = useState<"all" | "error" | "warning" | "info">("all");
  const [reloading, setReloading] = useState(false);
  if (!r) return <Fallback title="데이터 검증 리포트" error={error} retry={() => mutate()} />;
  const shown = r.issues.filter((i) => sev === "all" || i.severity === sev);
  const reload = async () => {
    setReloading(true);
    try {
      const res = await fetch("/api/admin/reload", { method: "POST" });
      if (res.ok) await mutate(await res.json(), { revalidate: false });
    } finally {
      setReloading(false);
    }
  };
  return (
    <div className="pt-3">
      <PageHeader title="데이터 검증 리포트" sub={`적재 ${formatDate(r.loaded_at)} · 파일 ${r.files_scanned}개`} />
      <Card className="p-4">
        <p className="break-all text-[11px] text-ink-faint">{r.research_dir}</p>
        <div className="mt-2 grid grid-cols-5 gap-1 text-center">
          {Object.entries(r.counts).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-paper-deep py-1.5">
              <p className="text-base font-extrabold">{v}</p>
              <p className="text-[10px] text-ink-soft">{k}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">
          오류 <b className="text-stamp">{r.summary.error}</b> · 경고 <b className="text-warn">{r.summary.warning}</b> · 정보 {r.summary.info}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-ink-faint">오류가 있는 파일은 도감에서 제외되며, 이유와 위치가 아래에 남아요. 조용히 누락되는 파일은 없어요.</p>
        <button type="button" onClick={reload} disabled={reloading} className="mt-3 rounded-full border-2 border-line-strong bg-butter px-4 py-1.5 text-xs font-bold disabled:opacity-60">
          {reloading ? "다시 읽는 중…" : "조사 MD 다시 읽기"}
        </button>
      </Card>
      <div className="no-scrollbar -mx-4 mb-2 mt-4 flex gap-1.5 overflow-x-auto px-4">
        {(["all", "error", "warning", "info"] as const).map((s) => (
          <Chip key={s} active={sev === s} onClick={() => setSev(s)}>
            {{ all: "전체", error: "오류", warning: "경고", info: "정보" }[s]}
          </Chip>
        ))}
      </div>
      {shown.length ? <IssueList issues={shown} /> : <EmptyState title="표시할 항목이 없어요" emoji="✅" />}
    </div>
  );
}
