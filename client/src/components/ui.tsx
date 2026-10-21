import { AlertTriangle, ExternalLink as ExternalIcon, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Tone = "neutral" | "ok" | "warn" | "stamp" | "sky" | "lilac" | "butter" | "mint" | "pink" | "peach";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted-soft text-ink-soft border-line",
  ok: "bg-ok-soft text-ok border-[#bfe5d0]",
  warn: "bg-warn-soft text-warn border-[#f3dca9]",
  stamp: "bg-stamp-soft text-stamp border-[#f6c4bf]",
  sky: "bg-sky text-[#2d5f96] border-[#b9d6f6]",
  lilac: "bg-lilac text-[#5b48b0] border-[#d3c6fb]",
  butter: "bg-butter text-[#8a6a12] border-[#f2df95]",
  mint: "bg-mint text-[#24745a] border-[#b2e2cc]",
  pink: "bg-pink text-[#a43d64] border-[#f7b9cd]",
  peach: "bg-peach text-[#9b4f2b] border-[#f6c1a5]",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return <As className={cx("rounded-3xl border-2 border-line bg-card shadow-sticker", className)}>{children}</As>;
}

export function SectionTitle({ children, right, id }: { children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between gap-2 px-1">
      <h2 id={id} className="font-display text-lg leading-tight text-ink">
        {children}
      </h2>
      {right}
    </div>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cx("inline-flex items-center gap-1 underline-offset-2 hover:underline", className)}>
      {children}
      <ExternalIcon aria-hidden className="h-3 w-3 shrink-0 opacity-60" />
      <span className="sr-only">(새 창)</span>
    </a>
  );
}

export function EmptyState({ title, children, emoji = "🫧" }: { title: string; children?: ReactNode; emoji?: string }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-line-strong bg-card/70 px-6 py-10 text-center">
      <div className="mb-2 text-4xl" aria-hidden>
        {emoji}
      </div>
      <p className="font-display text-base text-ink">{title}</p>
      {children && <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  const offline = /fetch|network|ECONNREFUSED|500|502|503|504/i.test(message);
  return (
    <div role="alert" className="flex flex-col items-center rounded-3xl border-2 border-[#f6c4bf] bg-stamp-soft/60 px-6 py-8 text-center">
      <AlertTriangle aria-hidden className="mb-2 h-8 w-8 text-stamp" />
      <p className="font-display text-base">자료를 불러오지 못했어요</p>
      <p className="mt-1 break-all text-xs text-ink-soft">
        {offline ? "API 서버(FastAPI)가 실행 중인지 확인해 주세요. " : ""}
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1 rounded-full border-2 border-line-strong bg-card px-4 py-1.5 text-sm font-semibold shadow-sticker-sm active:translate-y-px"
        >
          <RefreshCw aria-hidden className="h-4 w-4" /> 다시 시도
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-2xl bg-paper-deep", className)} />;
}

export function LoadingList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

export function NoSource() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
      <Inbox aria-hidden className="h-3 w-3" /> 출처 없음
    </span>
  );
}

export function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cx(
        "shrink-0 whitespace-nowrap rounded-full border-2 px-3 py-1 text-[13px] font-semibold transition active:translate-y-px",
        active ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-soft hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}
