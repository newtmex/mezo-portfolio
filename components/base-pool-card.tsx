import type { BasePoolReport } from "@/lib/report/base-pool";
import { formatAmount, shortenAddress } from "@/lib/utils";

export function BasePoolCard({ report }: { report: BasePoolReport }) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-sky-400/20 bg-gradient-to-b from-sky-400/[0.08] to-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">{report.pairLabel}</h3>
          <p className="mt-1 font-mono text-[11px] text-zinc-500">
            Base · Aerodrome Slipstream · {shortenAddress(report.pool, 5)}
          </p>
        </div>
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wide text-sky-200/80">Network</p>
          <p className="font-mono text-sm font-semibold text-sky-100">Base</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 sm:grid-cols-4">
        <div>
          <p className="text-zinc-500">Tick</p>
          <p className="font-mono text-zinc-200">{report.tick}</p>
        </div>
        <div>
          <p className="text-zinc-500">Tight range</p>
          <p className="font-mono text-zinc-200">
            [{report.range.tickLower}, {report.range.tickUpper})
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Active L</p>
          <p className="font-mono text-zinc-200">{formatAmount(report.activeLiquidity, 4)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Fee / spacing</p>
          <p className="font-mono text-zinc-200">
            {report.fee} / {report.tickSpacing}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {report.balances.map((balance) => (
          <div key={balance.symbol} className="rounded-xl border border-white/5 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Pool {balance.symbol}
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-100">
              {formatAmount(balance.amount, 6)}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-auto text-[11px] text-zinc-500">
        Active-liquidity tracker only · Base position is currently unstaked.
      </p>
    </article>
  );
}
