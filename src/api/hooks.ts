import { useInfiniteQuery, useQuery, type QueryKey } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useT } from "@/i18n";
import { useSession } from "@/stores/session";
import { rangeDates, useUi } from "@/stores/ui";
import { ApiError } from "./client";
import * as api from "./endpoints";
import type { Page } from "./types";

/**
 * Every cache key starts with the user and organisation, so a second person on
 * the same browser, or another farm account, never sees cached payloads (12).
 */
export function useKey() {
  const orgId = useSession((s) => s.activeOrgId);
  const userId = useSession((s) => s.user?.id);
  return useCallback((...parts: unknown[]): QueryKey => [userId, orgId, ...parts], [orgId, userId]);
}

export function useCatalogue() {
  return useQuery({ queryKey: ["catalogue"], queryFn: api.catalogue.get, staleTime: Infinity });
}

export function useFarms() {
  const key = useKey();
  const orgId = useSession((s) => s.activeOrgId);
  return useQuery({ queryKey: key("farms"), queryFn: api.farms.list, enabled: !!orgId, select: (p) => p.results });
}

/** The farm chosen in the top bar, falling back to the first farm. */
export function useFarm() {
  const orgId = useSession((s) => s.activeOrgId);
  const chosen = useUi((s) => (orgId ? s.farmByOrg[orgId] : undefined));
  const farms = useFarms();
  const farm = farms.data?.find((f) => f.id === chosen) ?? farms.data?.[0] ?? null;
  // Loading means the first attempt only. React Query puts a failed query with no data back
  // into "pending" when it retries, so gating on isLoading alone can loop forever.
  const isLoading = farms.isLoading && farms.errorUpdateCount === 0;
  return { farm, farms: farms.data ?? [], isLoading, error: farms.error, refetch: farms.refetch };
}

export function useFarmId(): string {
  return useFarm().farm?.id ?? "";
}

export function useNavigation() {
  const key = useKey();
  const farmId = useFarmId();
  return useQuery({ queryKey: key("navigation", farmId), queryFn: () => api.farms.navigation(farmId), enabled: !!farmId });
}

export function useRange() {
  const preset = useUi((s) => s.range);
  return useMemo(() => ({ preset, ...rangeDates(preset) }), [preset]);
}

export function useItems() {
  const key = useKey();
  return useQuery({ queryKey: key("items"), queryFn: api.stock.items, select: (p) => p.results, staleTime: 60_000 });
}

export function useEnterprises(module?: string) {
  const key = useKey();
  const farmId = useFarmId();
  return useQuery({
    queryKey: key("enterprises", farmId, module ?? "all"),
    queryFn: () => api.enterprises.list({ farm_id: farmId, module }),
    enabled: !!farmId,
    select: (p) => p.results,
  });
}

/** Cursor pagination for list endpoints: pulls the cursor out of `next`, which may be a full URL. */
export function usePaged<T>(key: QueryKey, fetcher: (cursor: string | undefined) => Promise<Page<T>>, enabled = true) {
  const q = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetcher(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.next ? (new URL(last.next, "http://x").searchParams.get("cursor") ?? undefined) : undefined),
    enabled,
  });
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.results) ?? [], [q.data]);
  return { ...q, rows };
}

/** Turns any thrown error into one sentence that says what happened and how to fix it (9). */
export function useErrorText() {
  const t = useT();
  return useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) return t.dyn(`error.${err.code}`, err.body.message || t("error.unknown"));
      if (err instanceof TypeError) return t("error.network");
      return t("error.unknown");
    },
    [t],
  );
}

export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  return Object.fromEntries(Object.entries(err.body.fields).map(([k, v]) => [k, v[0] ?? ""]));
}
