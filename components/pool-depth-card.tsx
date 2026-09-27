import type { ClRangeDepthReport } from "@/lib/report/types";
import { formatAmount, shortenAddress } from "@/lib/utils";

function formatLeaveAmount(value: string): string {
  const match = value.match(/^([+-]?\d*\.?\d+)(.*)$/);
  if (!match) return value;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return value;
  const absoluteAmount = Math.abs(amount);
  const formatted = absoluteAmount < 1 ? formatAmount(match[1], 5) : amount.toFixed(2);
  return `${formatted}${match[2]}`;
}

function DepthRow({
  label,
  side0,
  side1,
  symbol0,
  symbol1,
}: {
  label: string;
  side0: string;
  side1: string;
  symbol0: string;
  symbol1: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[11px] text-zinc-500">Sell {symbol0} → leave lower</p>
          <p className="mt-0.5 font-mono text-sm text-zinc-100">{formatLeaveAmount(side0)}</p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500">Sell {symbol1} → leave upper</p>
          <p className="mt-0.5 font-mono text-sm text-zinc-100">{formatLeaveAmount(side1)}</p>
        </div>
      </div>
    </div>
  );
}

export function PoolDepthCard({ report }: { report: ClRangeDepthReport }) {
  const withScenario = report.scenarios[0];
  const withoutScenario = report.scenarios[1];
  const share = Number(report.managerActiveLiquidityShareBps ?? 0) / 100;
  const stakedShare = Number(report.managerStakedActiveLiquidityShareBps ?? 0) / 100;
  const unstakedShare = Math.max(0, share - stakedShare);

  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">{report.pairLabel}</h3>
          <p className="mt-1 font-mono text-[11px] text-zinc-500">
            {shortenAddress(report.pool, 5)} · spacing {report.tickSpacing} · fee {report.fee}
          </p>
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
          <p className="text-zinc-500">Portfolio L</p>
          <p className="font-mono text-zinc-200">
            {formatAmount(report.managerInRangeLiquidity, 4)}
          </p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
          style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
        />
      </div>

      {withScenario ? (
        <DepthRow
          label="With portfolio liquidity"
          side0={withScenario.sellToken0ToLeaveLower.formatted}
          side1={withScenario.sellToken1ToLeaveUpper.formatted}
          symbol0={report.token0.symbol}
          symbol1={report.token1.symbol}
        />
      ) : null}
      {withoutScenario ? (
        <DepthRow
          label="Without portfolio liquidity"
          side0={withoutScenario.sellToken0ToLeaveLower.formatted}
          side1={withoutScenario.sellToken1ToLeaveUpper.formatted}
          symbol0={report.token0.symbol}
          symbol1={report.token1.symbol}
        />
      ) : null}

      <div className="mt-auto grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-black/20 p-3 text-sm">
        <div>
          <p className="text-[11px] text-zinc-500">Depth Δ % {report.token0.symbol}</p>
          <p className="font-mono text-zinc-100">
            {report.priceMoveDepthDiff.sellToken0ToLeaveLower}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500">Depth Δ % {report.token1.symbol}</p>
          <p className="font-mono text-zinc-100">
            {report.priceMoveDepthDiff.sellToken1ToLeaveUpper}
          </p>
        </div>
      </div>

      {report.managerTokenIds.length > 0 ? (
        <p className="text-[11px] text-zinc-500">
          NFTs:{" "}
          {report.managerTokenIds
            .map(
              (id) =>
                `#${id}${report.managerStakedTokenIds.includes(id) ? " (staked)" : ""}`,
            )
            .join(", ")}
        </p>
      ) : (
        <p className="text-[11px] text-zinc-500">No portfolio NFTs in this tight range.</p>
      )}
    </article>
  );
}
