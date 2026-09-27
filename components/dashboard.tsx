"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { getAddress, isAddress } from "viem";

import { ClPositionsTable } from "@/components/cl-positions-table";
import { DashboardHeader } from "@/components/dashboard-header";
import { LiquiditySummaryTable } from "@/components/liquidity-summary-table";
import { LiveEventFeed } from "@/components/live-event-feed";
import { PoolDepthCard } from "@/components/pool-depth-card";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { TokenHoldingsTable } from "@/components/token-holdings-table";
import type { LiveEventItem, WsConnectionState } from "@/lib/events/types";
import { startManagerEventWatchers } from "@/lib/events/watchers";
import { PAIRS } from "@/lib/config";
import type { ClRangeDepthReport } from "@/lib/report/types";

async function fetchRangeDepth() {
  const response = await fetch("/api/range-depth", { cache: "no-store" });
  if (!response.ok) throw new Error((await response.json()).error ?? "Failed to fetch range-depth report");
  return response.json();
}

async function fetchPool(key: string): Promise<ClRangeDepthReport> {
  const response = await fetch(`/api/range-depth?pool=${encodeURIComponent(key)}`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.json()).error ?? `Failed to fetch ${key}`);
  return response.json();
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [wsState, setWsState] = useState<WsConnectionState>("idle");
  const [events, setEvents] = useState<LiveEventItem[]>([]);

  const query = useQuery({
    queryKey: ["range-depth"],
    queryFn: fetchRangeDepth,
    refetchInterval: wsState === "connected" ? 60_000 : 15_000,
  });
  const poolQueries = useQueries({
    queries: PAIRS.map((pair) => ({
      queryKey: ["pool-range-depth", pair.key],
      queryFn: () => fetchPool(pair.key),
      refetchInterval: wsState === "connected" ? 60_000 : 15_000,
    })),
  });

  const queryManager = query.data?.manager;
  const fromEnv = process.env.NEXT_PUBLIC_MANAGER_ADDRESS?.trim();
  const manager = fromEnv && isAddress(fromEnv)
    ? getAddress(fromEnv)
    : queryManager && isAddress(queryManager)
      ? getAddress(queryManager)
      : null;

  const onRefreshNeeded = useCallback((source?: string) => {
    const pair = PAIRS.find((candidate) => candidate.label === source);
    if (pair) {
      void queryClient.invalidateQueries({ queryKey: ["pool-range-depth", pair.key] });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["range-depth"] });
    void queryClient.invalidateQueries({ queryKey: ["pool-range-depth"] });
  }, [queryClient]);

  useEffect(() => {
    if (!manager) return;
    const handle = startManagerEventWatchers(manager, {
      onEvent: (event) => {
        setEvents((prev) => {
          if (prev.some((row) => row.id === event.id)) return prev;
          return [event, ...prev].slice(0, 50);
        });
      },
      onState: setWsState,
      onRefreshNeeded,
    });
    return () => handle.stop();
  }, [manager, onRefreshNeeded]);

  const reports = poolQueries
    .map((pool) => pool.data)
    .filter((report): report is ClRangeDepthReport => Boolean(report));

  if (query.isLoading && !query.data && poolQueries.every((pool) => pool.isLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
          <p className="text-sm font-medium text-zinc-200">Loading manager range-depth…</p>
          <p className="mt-2 text-xs text-zinc-500">
            Reading Mezo mainnet pools, gauges, and Mezo API prices
          </p>
        </div>
      </div>
    );
  }

  if (query.isError && !query.data && reports.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/10 px-6 py-8 text-center">
          <p className="text-sm font-medium text-rose-100">Failed to load range-depth report</p>
          <p className="mt-2 text-xs text-rose-200/80">
            {query.error instanceof Error ? query.error.message : "Unknown error"}
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const data = query.data;
  if (!manager) return null;

  return (
    <div className="space-y-6">
      <DashboardHeader
        manager={manager}
        fetchedAt={data?.fetchedAt}
        wsState={wsState}
        refreshing={query.isFetching || poolQueries.some((pool) => pool.isFetching)}
        onRefresh={() => {
          void query.refetch();
          void queryClient.invalidateQueries({ queryKey: ["pool-range-depth"] });
        }}
      />

      {data ? <PortfolioSummary data={data} /> : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {PAIRS.map((pair, index) => (
          poolQueries[index].data ? <PoolDepthCard key={pair.key} report={poolQueries[index].data} /> :
            <div key={pair.key} className="min-h-64 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-500">Loading {pair.label}…</div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <TokenHoldingsTable
            rows={data?.holdings.tokens ?? []}
            total={data?.holdings.tokenTotalMusd ?? null}
          />
          <ClPositionsTable
            rows={data?.holdings.clPositions ?? []}
            total={data?.holdings.clTotalMusd ?? null}
          />
        <LiquiditySummaryTable rows={data?.summary ?? reports.map((report) => ({ pair: report.pairLabel, managerActivePct: report.managerActiveLiquidityShare, managerActiveBps: report.managerActiveLiquidityShareBps, managerL: report.managerInRangeLiquidity, activeL: report.activeLiquidity, depthDiffToken0: report.priceMoveDepthDiff.sellToken0ToLeaveLower, depthDiffToken1: report.priceMoveDepthDiff.sellToken1ToLeaveUpper }))} />
        </div>
        <LiveEventFeed events={events} />
      </section>
    </div>
  );
}
