"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";

import {
  depthDiffRatioBps,
  formatBpsPercent,
} from "@/lib/math/depth";
import {
  type BuyToken,
  humanPriceToken1PerToken0,
  sellAmountToReachHumanPrice,
} from "@/lib/math/price";
import { cn, formatAmount } from "@/lib/utils";

function formatPriceInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toPrecision(6);
  return value.toPrecision(6);
}

function formatSellAmount(amountRaw: bigint, decimals: number, symbol: string): string {
  const human = formatUnits(amountRaw, decimals);
  const numeric = Number(human);
  if (!Number.isFinite(numeric)) return `${human} ${symbol}`;
  const formatted = Math.abs(numeric) < 1 ? formatAmount(human, 5) : numeric.toFixed(2);
  return `${formatted} ${symbol}`;
}

export function TargetPriceSellPanel({
  symbol0,
  symbol1,
  decimals0,
  decimals1,
  sqrtPriceX96,
  fee,
  withLiquidity,
  withoutLiquidity,
  accent = "amber",
}: {
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  sqrtPriceX96: string;
  fee: string;
  withLiquidity: string;
  withoutLiquidity: string;
  accent?: "amber" | "sky";
}) {
  const sqrt = useMemo(() => BigInt(sqrtPriceX96), [sqrtPriceX96]);
  const feeRaw = useMemo(() => BigInt(fee), [fee]);
  const currentPrice = useMemo(
    () => humanPriceToken1PerToken0(sqrt, decimals0, decimals1),
    [sqrt, decimals0, decimals1],
  );

  const [buyToken, setBuyToken] = useState<BuyToken>(1);
  const [targetInput, setTargetInput] = useState(() => formatPriceInput(currentPrice));

  const targetPrice = Number(targetInput);
  const sellSymbol = buyToken === 1 ? symbol0 : symbol1;
  const buySymbol = buyToken === 1 ? symbol1 : symbol0;
  const sellDecimals = buyToken === 1 ? decimals0 : decimals1;

  const withResult = useMemo(
    () =>
      sellAmountToReachHumanPrice({
        sqrtPriceX96: sqrt,
        targetHumanPrice: targetPrice,
        buyToken,
        liquidity: BigInt(withLiquidity),
        fee: feeRaw,
        decimals0,
        decimals1,
      }),
    [sqrt, targetPrice, buyToken, withLiquidity, feeRaw, decimals0, decimals1],
  );

  const withoutResult = useMemo(
    () =>
      sellAmountToReachHumanPrice({
        sqrtPriceX96: sqrt,
        targetHumanPrice: targetPrice,
        buyToken,
        liquidity: BigInt(withoutLiquidity),
        fee: feeRaw,
        decimals0,
        decimals1,
      }),
    [sqrt, targetPrice, buyToken, withoutLiquidity, feeRaw, decimals0, decimals1],
  );

  const depthDiff =
    withResult.ok && withoutResult.ok
      ? formatBpsPercent(depthDiffRatioBps(withResult.amountRaw, withoutResult.amountRaw))
      : "n/a";

  const sharedError =
    !withResult.ok && !withoutResult.ok
      ? withResult.reason
      : !Number.isFinite(targetPrice) || targetPrice <= 0
        ? "Enter a positive target price."
        : null;

  const toggleClass =
    accent === "sky"
      ? "border-sky-400/30 bg-sky-400/10 text-sky-100"
      : "border-amber-400/30 bg-amber-400/10 text-amber-100";
  const activeToggleClass =
    accent === "sky"
      ? "bg-sky-400/25 text-sky-50"
      : "bg-amber-400/25 text-amber-50";

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="min-w-[10rem] flex-1">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
              Target price ({symbol1} per {symbol0})
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={targetInput}
              onChange={(event) => setTargetInput(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-600 focus:border-white/25"
              placeholder={formatPriceInput(currentPrice) || "0"}
            />
          </label>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Buy token</p>
            <div className={cn("mt-1 inline-flex rounded-lg border p-0.5", toggleClass)}>
              <button
                type="button"
                onClick={() => setBuyToken(0)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                  buyToken === 0 ? activeToggleClass : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                {symbol0}
              </button>
              <button
                type="button"
                onClick={() => setBuyToken(1)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                  buyToken === 1 ? activeToggleClass : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                {symbol1}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          Spot {formatPriceInput(currentPrice) || "n/a"} {symbol1}/{symbol0} · buy {buySymbol} by
          selling {sellSymbol}
        </p>
        {sharedError ? <p className="mt-2 text-[11px] text-rose-300/90">{sharedError}</p> : null}
      </div>

      <div className="grid gap-2">
        {(
          [
            { label: "With portfolio liquidity", result: withResult },
            { label: "Without portfolio liquidity", result: withoutResult },
          ] as const
        ).map((row) => (
          <div key={row.label} className="rounded-xl border border-white/5 bg-black/20 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              {row.label}
            </p>
            <p className="text-[11px] text-zinc-500">
              Sell {sellSymbol} → buy {buySymbol} to target
            </p>
            <p className="mt-0.5 font-mono text-sm text-zinc-100">
              {row.result.ok
                ? formatSellAmount(row.result.amountRaw, sellDecimals, sellSymbol)
                : row.result.reason}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-sm">
        <p className="text-[11px] text-zinc-500">Depth Δ % {sellSymbol}</p>
        <p className="font-mono text-zinc-100">{depthDiff}</p>
      </div>
    </div>
  );
}
