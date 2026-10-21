import { Link2Off } from "lucide-react";

import { formatDate, hostname } from "@/lib/format";
import { LINK_STATUS, SOURCE_TYPE } from "@/lib/labels";
import type { LinkStatus } from "@/lib/types";
import { Badge, ExternalLink, NoSource } from "./ui";

/** A cited URL with its source type, check date and link health. */
export function SourceLink({
  url,
  sourceType,
  checkedAt,
  title,
  linkStatus = "unchecked",
  compact = false,
}: {
  url: string | null | undefined;
  sourceType?: string | null;
  checkedAt?: string | null;
  title?: string | null;
  linkStatus?: LinkStatus;
  compact?: boolean;
}) {
  if (!url) return <NoSource />;
  const dead = linkStatus === "dead" || linkStatus === "error";
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-soft">
      <ExternalLink href={url} className="min-w-0 font-semibold text-[#5b4bd6]">
        <span className="truncate">{title || hostname(url)}</span>
      </ExternalLink>
      {!compact && sourceType && sourceType !== "unknown" && <Badge tone="sky">{SOURCE_TYPE[sourceType] ?? sourceType}</Badge>}
      {checkedAt && <span>확인 {formatDate(checkedAt)}</span>}
      {dead && (
        <Badge tone="stamp" title="출처 링크가 응답하지 않지만 기록은 유지됩니다">
          <Link2Off aria-hidden className="h-3 w-3" /> {LINK_STATUS[linkStatus]}
        </Badge>
      )}
    </span>
  );
}
