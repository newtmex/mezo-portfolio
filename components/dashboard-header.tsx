"use client";

import { ExternalLink, RefreshCw } from "lucide-react";

import { ConnectionStatus } from "@/components/connection-status";
import type { WsConnectionState } from "@/lib/events/types";
import { MEZO_CHAIN_ID, MEZO_EXPLORER } from "@/lib/config";
import { explorerAddressUrl, shortenAddress } from "@/lib/utils";

export function DashboardHeader(props: {
  manager: string;
  fetchedAt?: string;
  wsState: WsConnectionState;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">
            Aurove Ops
          </p>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">
            Mezo {MEZO_CHAIN_ID}
          </span>
          <ConnectionStatus state={props.wsState} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Manager range-depth
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Live report of manager tight-range liquidity share, price-move depth, wallet balances,
          and CL positions — matching{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-200">
            pnpm ops manage manager-range-depth mainnet
          </code>
          .
        </p>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <a
          href={explorerAddressUrl(MEZO_EXPLORER, props.manager)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-sm text-zinc-200 hover:text-amber-200"
        >
          {shortenAddress(props.manager, 6)}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <div className="flex items-center gap-3">
          <p className="text-xs text-zinc-500">
            {props.fetchedAt
              ? `Updated ${new Date(props.fetchedAt).toLocaleTimeString()}`
              : "Waiting for first fetch"}
          </p>
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={props.refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${props.refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
