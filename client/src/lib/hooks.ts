"use client";

import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";

import { apiSend, fetcher } from "./api";
import type { Health, Progress, Stage } from "./types";

export function useHealth() {
  return useSWR<Health>("/api/health", fetcher, { revalidateOnFocus: false });
}

/** Stamps and store visits, persisted in the server's SQLite DB. */
export function useProgress() {
  const { mutate: globalMutate } = useSWRConfig();
  const swr = useSWR<Progress>("/api/progress", fetcher);

  // Lists that embed my_stage / visited need a refresh after a stamp changes.
  const refreshDependents = useCallback(() => {
    void globalMutate((key) => typeof key === "string" && /^\/api\/(models|stores|compare)/.test(key));
  }, [globalMutate]);

  const setStage = useCallback(
    async (modelId: string, stage: Stage | null) => {
      const next = await apiSend<Progress>("/api/progress", { target_type: "model", target_id: modelId, stage });
      await swr.mutate(next, { revalidate: false });
      refreshDependents();
    },
    [swr, refreshDependents],
  );

  const setVisited = useCallback(
    async (storeId: string, visited: boolean, visitedOn?: string) => {
      const next = await apiSend<Progress>("/api/progress", {
        target_type: "store",
        target_id: storeId,
        visited,
        visited_on: visitedOn ?? null,
      });
      await swr.mutate(next, { revalidate: false });
      refreshDependents();
    },
    [swr, refreshDependents],
  );

  const stageOf = useCallback(
    (modelId: string): Stage | null => swr.data?.models.find((m) => m.model_id === modelId)?.stage ?? null,
    [swr.data],
  );
  const visitedOf = useCallback(
    (storeId: string) => swr.data?.stores.find((s) => s.store_id === storeId) ?? null,
    [swr.data],
  );

  return { ...swr, setStage, setVisited, stageOf, visitedOf };
}
