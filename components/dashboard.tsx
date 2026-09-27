"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Activity, Bell, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatUsd } from "@/lib/utils";
import { getAddress, isAddress } from "viem";

import { ClPositionsTable } from "@/components/cl-positions-table";
import { DashboardHeader } from "@/components/dashboard-header";
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

function playUpdateSound() {
  if (typeof window === "undefined") return;
  const audioContext = new AudioContext();
  const notes = [659.25, 783.99, 987.77, 1318.51];
  const noteLength = 0.18;
  const start = audioContext.currentTime;

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const noteStart = start + index * noteLength;
    const noteEnd = noteStart + noteLength * 1.35;
    oscillator.type = index === notes.length - 1 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.075, noteStart + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd);
  });

  window.setTimeout(() => void audioContext.close(), notes.length * noteLength * 1000 + 300);
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [wsState, setWsState] = useState<WsConnectionState>("idle");
  const [events, setEvents] = useState<LiveEventItem[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  const enableAlerts = async () => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    const audioContext = new AudioContext();
    await audioContext.resume();
    await audioContext.close();
    setAlertsEnabled(true);
  };

  const query = useQuery({
    queryKey: ["range-depth"],
    queryFn: fetchRangeDepth,
  });
  const poolQueries = useQueries({
    queries: PAIRS.map((pair) => ({
      queryKey: ["pool-range-depth", pair.key],
      queryFn: () => fetchPool(pair.key),
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
      // Pool swaps change spot prices, so refresh portfolio valuations too.
      void queryClient.invalidateQueries({ queryKey: ["range-depth"] });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["range-depth"] });
    void queryClient.invalidateQueries({ queryKey: ["pool-range-depth"] });
  }, [queryClient]);

  useEffect(() => {
    if (!manager) return;
    const handle = startManagerEventWatchers(manager, {
        onEvent: (event) => {
          if (alertsEnabled) {
            playUpdateSound();
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`Portfolio update · ${event.kind}`, {
                body: `${event.source}: ${event.summary}`,
                tag: event.id,
              });
            }
          }
          setEvents((prev) => {
          if (prev.some((row) => row.id === event.id)) return prev;
          return [event, ...prev].slice(0, 50);
        });
      },
      onState: setWsState,
      onRefreshNeeded,
    });
    return () => handle.stop();
  }, [alertsEnabled, manager, onRefreshNeeded]);

  if (query.isLoading && !query.data && poolQueries.every((pool) => pool.isLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
          <p className="text-sm font-medium text-zinc-200">Loading portfolio range depth…</p>
          <p className="mt-2 text-xs text-zinc-500">
            Reading Mezo mainnet pools, gauges, and Mezo API prices
          </p>
        </div>
      </div>
    );
  }

  if (query.isError && !query.data && poolQueries.every((pool) => !pool.data)) {
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
      <button
        type="button"
        onClick={() => void enableAlerts()}
        className={`fixed right-28 top-4 z-30 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-xl backdrop-blur transition ${alertsEnabled ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-zinc-950/90 text-zinc-100 hover:bg-white/10"}`}
        aria-label={alertsEnabled ? "Portfolio alerts enabled" : "Enable portfolio alerts"}
      >
        <Bell className="h-3.5 w-3.5" />
        {alertsEnabled ? "Alerts on" : "Enable alerts"}
      </button>
      <button
        type="button"
        onClick={() => setActivityOpen(true)}
        className="fixed right-4 top-4 z-30 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/90 px-3 py-2 text-xs font-medium text-zinc-100 shadow-xl backdrop-blur transition hover:bg-white/10"
        aria-label="Open live on-chain activity"
      >
        <Activity className="h-3.5 w-3.5 text-amber-300" />
        Activity{events.length > 0 ? ` (${events.length})` : ""}
      </button>

      {activityOpen ? (
        <>
          <button
            type="button"
            aria-label="Close live on-chain activity"
            onClick={() => setActivityOpen(false)}
            className="fixed inset-0 z-40 bg-black/50"
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-zinc-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">Live activity</p>
              <button
                type="button"
                onClick={() => setActivityOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                aria-label="Close live on-chain activity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <LiveEventFeed events={events} />
          </aside>
        </>
      ) : null}

      <DashboardHeader
        manager={manager}
        fetchedAt={data?.fetchedAt}
        wsState={wsState}
        refreshing={query.isFetching || poolQueries.some((pool) => pool.isFetching)}
        portfolioControls={data ? (
          <>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:bg-white/10">
                Tokens {formatUsd(data.holdings.tokenTotalMusd)}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-[min(90vw,42rem)] rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl outline-none">
                <TokenHoldingsTable rows={data.holdings.tokens} total={data.holdings.tokenTotalMusd} />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:bg-white/10">
                CL {formatUsd(data.holdings.clTotalMusd)}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-[min(90vw,64rem)] rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl outline-none">
                <ClPositionsTable rows={data.holdings.clPositions} total={data.holdings.clTotalMusd} />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        ) : null}
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

    </div>
  );
}
