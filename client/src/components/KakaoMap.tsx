"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { StoreSummary } from "@/lib/types";

// Kakao Maps JS SDK has no official TypeScript types; keep the surface we use minimal.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KakaoNS = any;
declare global {
  interface Window {
    kakao?: KakaoNS;
  }
}

export type MapStatus = "no_key" | "loading" | "ready" | "failed";

const APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || "";
const GEO_CACHE_KEY = "salimmon.geocode.v1";
let sdkPromise: Promise<KakaoNS> | null = null;

function loadSdk(): Promise<KakaoNS> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(APP_KEY)}&autoload=false&libraries=services`;
    script.async = true;
    const timer = setTimeout(() => reject(new Error("Kakao SDK 로드 시간 초과")), 10000);
    script.onload = () => {
      clearTimeout(timer);
      if (!window.kakao?.maps) return reject(new Error("Kakao SDK 초기화 실패 (앱 키·도메인 등록 확인)"));
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Kakao SDK 스크립트를 불러오지 못했어요"));
    };
    document.head.appendChild(script);
  }).catch((e) => {
    sdkPromise = null;
    throw e;
  });
  return sdkPromise;
}

function readGeoCache(): Record<string, [number, number] | null> {
  try {
    return JSON.parse(window.localStorage.getItem(GEO_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeGeoCache(cache: Record<string, [number, number] | null>) {
  try {
    window.localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function pinColor(s: StoreSummary) {
  if (s.models_on_display.length) return "#2f8f63";
  if (s.display_status === "store_only_verified") return "#4a7fc1";
  return "#9d93a6";
}

function pinElement(s: StoreSummary, approximate: boolean, selected: boolean, onClick: () => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${s.name}${approximate ? " (주소 기반 위치)" : ""}`);
  const color = pinColor(s);
  el.style.cssText = [
    "transform:translate(-50%,-100%)",
    "display:flex;flex-direction:column;align-items:center;cursor:pointer;background:none;border:0;padding:0",
  ].join(";");
  el.innerHTML = `
    <span style="display:flex;align-items:center;gap:3px;max-width:140px;padding:3px 8px;border-radius:999px;
      background:${selected ? "#3a3242" : "#fffdf9"};color:${selected ? "#fff8ef" : "#3a3242"};
      border:2px ${approximate ? "dashed" : "solid"} ${color};font:700 11px/1.3 sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      box-shadow:0 2px 0 ${color}55">
      ${s.visited ? "✅" : s.models_on_display.length ? "🛏️" : "🏬"}
      <span style="overflow:hidden;text-overflow:ellipsis">${s.name.replace(/[<>&"]/g, "")}</span>
    </span>
    <span style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color}"></span>`;
  el.addEventListener("click", onClick);
  return el;
}

/**
 * Kakao map with store pins. Verified coordinates are used as-is; stores with only an
 * address are geocoded in the browser and drawn with a dashed (approximate) pin.
 */
export function KakaoMap({
  stores,
  selectedId,
  onSelect,
  onStatus,
}: {
  stores: StoreSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStatus: (status: MapStatus, detail?: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoNS>(null);
  const overlays = useRef<KakaoNS[]>([]);
  const [ready, setReady] = useState(false);
  const [geocoded, setGeocoded] = useState<Record<string, [number, number] | null>>({});

  // Verified coordinates first, then addresses geocoded in this browser (cached in localStorage).
  const positions = useMemo(() => {
    const out: Record<string, { lat: number; lng: number; approximate: boolean }> = {};
    if (!ready) return out;
    const cache = { ...readGeoCache(), ...geocoded };
    for (const s of stores) {
      if (s.lat !== null && s.lng !== null) out[s.id] = { lat: s.lat, lng: s.lng, approximate: false };
      else if (s.address && cache[s.address]) out[s.id] = { lat: cache[s.address]![0], lng: cache[s.address]![1], approximate: true };
    }
    return out;
  }, [ready, stores, geocoded]);

  // Load SDK + create map once
  useEffect(() => {
    if (!APP_KEY) {
      onStatus("no_key");
      return;
    }
    let cancelled = false;
    onStatus("loading");
    loadSdk()
      .then((kakao) => {
        if (cancelled || !box.current) return;
        mapRef.current = new kakao.maps.Map(box.current, { center: new kakao.maps.LatLng(37.5665, 126.978), level: 9 });
        setReady(true);
        onStatus("ready");
      })
      .catch((e: Error) => !cancelled && onStatus("failed", e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocode addresses that are not cached yet
  useEffect(() => {
    if (!ready) return;
    const kakao = window.kakao;
    const cache = readGeoCache();
    const pending = [...new Set(stores.filter((s) => s.lat === null && s.address && !(s.address in cache)).map((s) => s.address!))];
    if (!pending.length) return;
    const geocoder = new kakao.maps.services.Geocoder();
    let cancelled = false;
    Promise.all(
      pending.map(
        (address) =>
          new Promise<void>((resolve) => {
            geocoder.addressSearch(address, (result: { x: string; y: string }[], status: string) => {
              if (status === kakao.maps.services.Status.OK && result[0]) cache[address] = [Number(result[0].y), Number(result[0].x)];
              else if (status === kakao.maps.services.Status.ZERO_RESULT) cache[address] = null;
              resolve();
            });
          }),
      ),
    ).then(() => {
      writeGeoCache(cache);
      if (!cancelled) setGeocoded({ ...cache });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, stores]);

  // Draw pins
  useEffect(() => {
    if (!ready) return;
    const kakao = window.kakao;
    const map = mapRef.current;
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];
    const bounds = new kakao.maps.LatLngBounds();
    let count = 0;
    for (const s of stores) {
      const p = positions[s.id];
      if (!p) continue;
      const pos = new kakao.maps.LatLng(p.lat, p.lng);
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content: pinElement(s, p.approximate, s.id === selectedId, () => onSelect(s.id)),
        yAnchor: 0,
        zIndex: s.id === selectedId ? 10 : 1,
        clickable: true,
      });
      overlay.setMap(map);
      overlays.current.push(overlay);
      bounds.extend(pos);
      count++;
    }
    if (count && !selectedId) map.setBounds(bounds, 40, 40, 40, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, positions, stores, selectedId]);

  // Pan to the selected store
  useEffect(() => {
    if (!ready || !selectedId || !positions[selectedId]) return;
    const p = positions[selectedId];
    mapRef.current.panTo(new window.kakao.maps.LatLng(p.lat, p.lng));
  }, [ready, selectedId, positions]);

  return <div ref={box} className="h-full w-full" />;
}
