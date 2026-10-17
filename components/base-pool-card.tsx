import type { BasePoolReport } from "@/lib/report/base-pool";
import { formatAmount, formatUsd, shortenAddress } from "@/lib/utils";
import { TargetPriceSellPanel } from "@/components/target-price-sell-panel";

export function BasePoolCard({ report }: { report: BasePoolReport }) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-sky-400/20 bg-gradient-to-b from-sky-400/[0.08] to-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">{report.pairLabel}</h3>
          <p className="mt-1 font-mono text-[11px] text-zinc-500">
            Base · Aerodrome Slipstream · {shortenAddress(report.pool, 5)}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Updated {new Date(report.fetchedAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wide text-sky-200/80">Network</p>
          <p className="font-mono text-sm font-semibold text-sky-100">Base</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2">
          <p className="text-zinc-500">Portfolio AERO / day</p>
          <p className="font-mono text-lg font-semibold text-sky-100">
            {report.aeroPerDay == null ? "n/a" : `${formatAmount(report.aeroPerDay, 5)} AERO`}
          </p>
          <p className="mt-0.5 text-[10px] text-sky-200/70">
            {formatUsd(report.aeroValueUsdPerDay)} per day
          </p>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
          <p className="text-zinc-500">Portfolio position value</p>
          <p className="font-mono text-lg font-semibold text-emerald-100">
            {formatUsd(report.managerStakedPositionValueUsd)}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-200/70">At current pool price</p>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
          <p className="text-zinc-500">Portfolio active share</p>
          <p className="font-mono text-lg font-semibold text-emerald-200">
            {report.managerStakedActiveLiquidityShareBps == null
              ? "n/a"
              : `${(Number(report.managerStakedActiveLiquidityShareBps) / 100).toFixed(2)}%`}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-200/70">of pool active liquidity</p>
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

      <TargetPriceSellPanel
        symbol0={report.token0.symbol}
        symbol1={report.token1.symbol}
        decimals0={report.token0.decimals}
        decimals1={report.token1.decimals}
        sqrtPriceX96={report.sqrtPriceX96}
        fee={report.fee}
        withLiquidity={report.activeLiquidity}
        withoutLiquidity={report.activeLiquidityWithoutManager}
        tickLower={report.range.tickLower}
        tickUpper={report.range.tickUpper}
        accent="sky"
      />

      {report.managerStakedTokenIds.length > 0 ? (
        <p className="mt-auto text-[11px] text-emerald-300/80">
          Staked position{report.managerStakedTokenIds.length === 1 ? "" : "s"}:{" "}
          {report.managerStakedTokenIds.map((id) => `#${id}`).join(", ")}
        </p>
      ) : (
        <p className="mt-auto text-[11px] text-zinc-500">
          No staked Base positions found for the configured manager.
        </p>
      )}
    </article>
  );
}
