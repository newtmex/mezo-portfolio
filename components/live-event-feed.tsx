"use client";

import { ExternalLink } from "lucide-react";

import type { LiveEventItem } from "@/lib/events/types";
import { MEZO_EXPLORER } from "@/lib/config";
import { explorerTxUrl, shortenAddress } from "@/lib/utils";

const KIND_COLORS: Record<string, string> = {
  Swap: "bg-sky-500/15 text-sky-300",
  Mint: "bg-emerald-500/15 text-emerald-300",
  Burn: "bg-rose-500/15 text-rose-300",
  Transfer: "bg-violet-500/15 text-violet-300",
  Deposit: "bg-amber-500/15 text-amber-200",
  Withdraw: "bg-orange-500/15 text-orange-200",
  IncreaseLiquidity: "bg-lime-500/15 text-lime-300",
  DecreaseLiquidity: "bg-fuchsia-500/15 text-fuchsia-300",
};

export function LiveEventFeed({ events }: { events: LiveEventItem[] }) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-100">Live on-chain activity</h2>
        <p className="text-xs text-zinc-500">
          Mezo WSS events for the portfolio wallet and watched pools
        </p>
      </div>
      <div className="min-h-[280px] flex-1 space-y-2 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">
            Waiting for Swap / Mint / Burn / Transfer / gauge Deposit events…
          </p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        KIND_COLORS[event.kind] ?? "bg-white/5 text-zinc-300"
                      }`}
                    >
                      {event.kind}
                    </span>
                    <span className="text-xs text-zinc-500">{event.source}</span>
                  </div>
                  <p className="text-sm text-zinc-200">{event.summary}</p>
                  <p className="font-mono text-[11px] text-zinc-500">
                    block {event.blockNumber} · {new Date(event.at).toLocaleTimeString()}
                  </p>
                </div>
                <a
                  href={explorerTxUrl(MEZO_EXPLORER, event.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400 hover:text-amber-200"
                >
                  {shortenAddress(event.txHash, 3)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
