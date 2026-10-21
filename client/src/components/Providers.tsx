"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import { fetcher } from "@/lib/api";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: false, keepPreviousData: true, errorRetryCount: 2 }}>
      {children}
    </SWRConfig>
  );
}
