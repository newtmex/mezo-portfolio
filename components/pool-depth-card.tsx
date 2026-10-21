import type { ClRangeDepthReport } from "@/lib/report/types";
import { shortenAddress } from "@/lib/utils";
import { TargetPriceSellPanel } from "@/components/target-price-sell-panel";

function formatApr(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(2)}%`;
}

export function PoolDepthCard({ report }: { report: ClRangeDepthReport }) {
  const share = Number(report.managerActiveLiquidityShareBps ?? 0) / 100;
  const stakedShare = Number(report.managerStakedActiveLiquidityShareBps ?? 0) / 100;
  const unstakedShare = Math.max(0, share - stakedShare);

  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">{report.pairLabel}</h3>
          <p className="mt-1 font-mono text-[11px] text-zinc-500">
            {shortenAddress(report.pool, 5)}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">
              Active liquidity APR
            </span>
            <span className="font-mono text-sm font-semibold text-emerald-100">
              {formatApr(report.activeLiquidityApr)}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wide text-amber-200/80">Portfolio active</p>
          <p className="font-mono text-xl font-semibold text-amber-100">
            {report.managerActiveLiquidityShare}
          </p>
          <div className="mt-1 flex justify-end gap-2 text-[10px] font-medium">
            <span className="text-emerald-300">Staked {stakedShare.toFixed(2)}%</span>
            <span className="text-sky-300">Unstaked {unstakedShare.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {report.hasPartialErrors ? (
        <p role="status" className="text-xs text-rose-200">
          An error occurred while loading some CL data.
        </p>
      ) : null}

      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
          style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
        />
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
        accent="amber"
      />

      {report.managerTokenIds.length > 0 ? (
        <p className="mt-auto text-[11px] text-zinc-500">
          NFTs:{" "}
          {report.managerTokenIds
            .map((id) => `#${id}${report.managerStakedTokenIds.includes(id) ? " (staked)" : ""}`)
            .join(", ")}
        </p>
      ) : (
        <p className="mt-auto text-[11px] text-zinc-500">No portfolio NFTs in this tight range.</p>
      )}
    </article>
  );
}
