export function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 1,250,000 → "125만원", 990,000 → "99만원", 1,234,500 → "123만 4,500원" */
export function formatKRWShort(amount: number): string {
  if (amount < 10000) return formatKRW(amount);
  const man = Math.floor(amount / 10000);
  const rest = amount % 10000;
  return rest ? `${man.toLocaleString("ko-KR")}만 ${rest.toLocaleString("ko-KR")}원` : `${man.toLocaleString("ko-KR")}만원`;
}

/** "2026-10-21" or ISO datetime → "2026.10.21" (local date for datetimes). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "날짜 없음";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replaceAll("-", ".");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Renders free-form spec values: [1500, 2000] → "1500 × 2000", {Q: "..."} → "Q: ..." */
export function formatSpecValue(value: unknown, unit: string | null): string {
  const withUnit = (s: string) => (unit ? `${s} ${unit}` : s);
  if (value === null || value === undefined || value === "") return "미확인";
  if (typeof value === "number") return withUnit(value.toLocaleString("ko-KR"));
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "number")) return withUnit(value.join(" × "));
    return value.map((v) => formatSpecValue(v, null)).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${formatSpecValue(v, unit)}`)
      .join(" · ");
  }
  return String(value);
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Maps relative links between research MD files to app routes. */
export function researchLinkToRoute(href: string): string | null {
  const m = href.match(/(?:^|\/)(categories|brands|models|stores|reviews)\/([a-z0-9][a-z0-9-]*)\.md(?:#.*)?$/);
  if (!m) return null;
  const [, dir, id] = m;
  switch (dir) {
    case "categories":
      return `/research/${id}`;
    case "brands":
      return `/brands/${id}`;
    case "models":
      return `/models/${id}`;
    case "stores":
      return `/stores/${id}`;
    case "reviews":
      return `/reviews/${id}`;
  }
  return null;
}

export function kakaoMapSearchUrl(query: string): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
}

export function naverMapSearchUrl(query: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

export function kakaoDirectionsUrl(name: string, lat: number, lng: number): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
}
