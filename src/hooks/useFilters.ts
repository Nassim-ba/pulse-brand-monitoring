"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MentionFilters, Sentiment, Topic } from "@/lib/types";

export type Sort = "date" | "relevance" | "urgency" | "reach";

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

/** Filter state shared by dashboard and mention list, kept in the URL so it survives navigation and can be shared. */
export function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: MentionFilters = useMemo(() => {
    const rel = params.get("rel");
    return {
      q: params.get("q") ?? "",
      sentiments: list(params.get("sentiment")) as Sentiment[],
      topics: list(params.get("topic")) as Topic[],
      sources: list(params.get("source")),
      range: (params.get("range") as MentionFilters["range"]) ?? "all",
      actionOnly: params.get("action") === "1",
      includeIrrelevant: rel === "0",
      minRelevance: rel && rel !== "0" ? Number(rel) : undefined,
    };
  }, [params]);

  const sort = (params.get("sort") as Sort) ?? "date";
  const rel = params.get("rel") ?? "";

  const update = useCallback(
    (patch: Record<string, string | string[] | boolean | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        const val = Array.isArray(v) ? v.join(",") : typeof v === "boolean" ? (v ? "1" : "") : (v ?? "");
        if (val) next.set(k, val);
        else next.delete(k);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  const activeCount =
    (filters.sentiments?.length ? 1 : 0) +
    (filters.topics?.length ? 1 : 0) +
    (filters.sources?.length ? 1 : 0) +
    (filters.range !== "all" ? 1 : 0) +
    (filters.actionOnly ? 1 : 0) +
    (rel ? 1 : 0) +
    (filters.q ? 1 : 0);

  return { filters, sort, rel, update, reset, activeCount };
}
