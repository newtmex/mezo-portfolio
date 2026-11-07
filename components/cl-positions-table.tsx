import { PriceRangeLine } from "@/components/price-range-line";
import type { ManagerClPositionValue } from "@/lib/report/types";
import { humanPriceToken1PerToken0 } from "@/lib/math/price";
import { sqrtRatioAtTick } from "@/lib/math/tick-math";
import { formatAmount, formatUsd } from "@/lib/utils";

function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "n/a";
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toPrecision(6);
  return value.toPrecision(6);
}

function priceAtTick(tick: number, decimals0: number, decimals1: number): number {
  return humanPriceToken1PerToken0(sqrtRatioAtTick(tick), decimals0, decimals1);
}

export function ClPositionsTable({
  rows,
  total,
  title = "Portfolio CL positions",
  subtitle = "Wallet + gauge-staked NFTs",
  currentTick,
  currentPrice,
  priceUnit,
  decimals0,
  decimals1,
  accent = "amber",
}: {
  rows: ManagerClPositionValue[];
  total: number | null;
  title?: string;
  subtitle?: string;
  currentTick?: number;
  currentPrice?: number;
  /** e.g. "MUSD per MEZO" */
  priceUnit?: string;
  decimals0?: number;
  decimals1?: number;
  accent?: "amber" | "sky";
}) {
  const canPriceRange =
    typeof decimals0 === "number" &&
    typeof decimals1 === "number" &&
    Number.isFinite(decimals0) &&
    Number.isFinite(decimals1);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <p className="text-xs text-zinc-500">{subtitle}</p>
          {currentTick != null || currentPrice != null ? (
            <p className="mt-1 font-mono text-[11px] text-zinc-400">
              Current{" "}
              {currentPrice != null ? (
                <>
                  {formatPrice(currentPrice)}
                  {priceUnit ? ` ${priceUnit}` : ""}
                </>
              ) : (
                "n/a"
              )}
              {currentTick != null ? <> · tick {currentTick}</> : null}
            </p>
          ) : null}
        </div>
        <p className="font-mono text-sm text-amber-200">{formatUsd(total)}</p>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No portfolio CL positions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-white/10">
                <th className="px-2 py-2 font-medium">NFT</th>
                <th className="px-2 py-2 font-medium">Staked</th>
                <th className="min-w-[14rem] px-2 py-2 font-medium">Range</th>
                <th className="px-2 py-2 font-medium">In range</th>
                <th className="px-2 py-2 font-medium">Token0</th>
                <th className="px-2 py-2 font-medium">Token1</th>
                <th className="px-2 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const priceLower = canPriceRange
                  ? priceAtTick(row.tickLower, decimals0!, decimals1!)
                  : null;
                const priceUpper = canPriceRange
                  ? priceAtTick(row.tickUpper, decimals0!, decimals1!)
                  : null;
                return (
                  <tr
                    key={`${row.pair}-${row.tokenId}`}
                    className="border-b border-white/5 text-zinc-200"
                  >
                    <td className="px-2 py-2.5 font-mono">#{row.tokenId}</td>
                    <td className="px-2 py-2.5">
                      <span
                        className={
                          row.staked
                            ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                            : "rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400"
                        }
                      >
                        {row.staked ? "yes" : "no"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      {priceLower != null && priceUpper != null ? (
                        <PriceRangeLine
                          rangeLower={priceLower}
                          rangeUpper={priceUpper}
                          currentPrice={currentPrice}
                          priceUnit={priceUnit}
                          accent={accent}
                          compact
                        />
                      ) : (
                        <span className="font-mono text-xs">
                          [{row.tickLower}, {row.tickUpper})
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={row.inRange ? "text-emerald-300" : "text-rose-300"}>
                        {row.inRange ? "yes" : "no"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs">
                      {formatAmount(row.amount0)} {row.symbol0}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs">
                      {formatAmount(row.amount1)} {row.symbol1}
                    </td>
                    <td className="px-2 py-2.5 font-mono">{formatUsd(row.valueMusd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
