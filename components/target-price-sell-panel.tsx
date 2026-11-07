"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatUnits } from "viem";

import { formatPriceLabel, PriceRangeLine } from "@/components/price-range-line";
import {
  type BuyToken,
  humanPriceToken1PerToken0,
  sellAmountToReachHumanPrice,
  type SellToTargetResult,
} from "@/lib/math/price";
import { sqrtRatioAtTick } from "@/lib/math/tick-math";
import { cn, formatAmount } from "@/lib/utils";

function formatSellAmount(amountRaw: bigint, decimals: number, symbol: string): string {
  const human = formatUnits(amountRaw, decimals);
  const numeric = Number(human);
  if (!Number.isFinite(numeric)) return `${human} ${symbol}`;
  if (numeric === 0) return `0 ${symbol}`;
  const formatted = Math.abs(numeric) < 1 ? formatAmount(human, 5) : numeric.toFixed(2);
  return `${formatted} ${symbol}`;
}

function amountLabel(result: SellToTargetResult, decimals: number, symbol: string): string {
  if (!result.ok) return "—";
  return formatSellAmount(result.amountRaw, decimals, symbol);
}

function buyTokenForTarget(target: number, spot: number): BuyToken {
  return target < spot ? 1 : 0;
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
  tickLower,
  tickUpper,
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
  tickLower: number;
  tickUpper: number;
  accent?: "amber" | "sky";
}) {
  const sqrt = useMemo(() => BigInt(sqrtPriceX96), [sqrtPriceX96]);
  const feeRaw = useMemo(() => BigInt(fee), [fee]);
  const currentPrice = useMemo(
    () => humanPriceToken1PerToken0(sqrt, decimals0, decimals1),
    [sqrt, decimals0, decimals1],
  );
  const activeRange = useMemo(() => {
    const lower = humanPriceToken1PerToken0(sqrtRatioAtTick(tickLower), decimals0, decimals1);
    const upper = humanPriceToken1PerToken0(sqrtRatioAtTick(tickUpper), decimals0, decimals1);
    return {
      lower: Math.min(lower, upper),
      upper: Math.max(lower, upper),
    };
  }, [tickLower, tickUpper, decimals0, decimals1]);

  const [buyToken, setBuyToken] = useState<BuyToken>(1);
  const [targetInput, setTargetInput] = useState(() => formatPriceLabel(currentPrice));
  const [priceUnitOpen, setPriceUnitOpen] = useState(false);
  const priceUnitId = useId();

  const spotRef = useRef(currentPrice);
  const buyTokenRef = useRef(buyToken);

  useEffect(() => {
    spotRef.current = currentPrice;
  }, [currentPrice]);
  useEffect(() => {
    buyTokenRef.current = buyToken;
  }, [buyToken]);

  const targetPrice = Number(targetInput);
  const hasTarget = Number.isFinite(targetPrice) && targetPrice > 0;
  const sellDecimals = buyToken === 1 ? decimals0 : decimals1;
  const sellSymbol = buyToken === 1 ? symbol0 : symbol1;
  const buySymbol = buyToken === 1 ? symbol1 : symbol0;

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

  const sharedError =
    !withResult.ok && !withoutResult.ok
      ? withResult.reason
      : !hasTarget
        ? "Enter a positive target price."
        : null;

  const withLabel = amountLabel(withResult, sellDecimals, sellSymbol);
  const withoutLabel = amountLabel(withoutResult, sellDecimals, sellSymbol);

  const applyProjectedPrice = useCallback((price: number) => {
    const spot = spotRef.current;
    if (!(price > 0) || !Number.isFinite(price)) return;
    const minGap = Math.max(spot * 1e-6, Number.EPSILON);
    let next = price;
    if (Math.abs(next - spot) < minGap) {
      next = buyTokenRef.current === 1 ? spot - minGap : spot + minGap;
    }
    if (next <= 0) next = minGap;

    setTargetInput(formatPriceLabel(next));
    const nextBuy = buyTokenForTarget(next, spot);
    if (nextBuy !== buyTokenRef.current) {
      buyTokenRef.current = nextBuy;
      setBuyToken(nextBuy);
    }
  }, []);

  const toggleClass =
    accent === "sky"
      ? "border-sky-400/30 bg-sky-400/10 text-sky-100"
      : "border-amber-400/30 bg-amber-400/10 text-amber-100";
  const activeToggleClass =
    accent === "sky" ? "bg-sky-400/25 text-sky-50" : "bg-amber-400/25 text-amber-50";

  const amountAlign =
    hasTarget && targetPrice < currentPrice ? "items-start text-left" : "items-end text-right";

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <button
          type="button"
          aria-expanded={priceUnitOpen}
          aria-controls={priceUnitId}
          onClick={() => setPriceUnitOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Target price
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 text-zinc-500 transition-transform", priceUnitOpen && "rotate-180")}
          />
        </button>

        {priceUnitOpen ? (
          <div id={priceUnitId}>
            <div className="mt-2">
              <label className="sr-only" htmlFor={`${priceUnitId}-input`}>
                Target price ({symbol1} per {symbol0})
              </label>
              <span className="flex min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black/40 focus-within:border-white/25">
                <input
                  id={`${priceUnitId}-input`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={targetInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTargetInput(value);
                    const next = Number(value);
                    if (
                      Number.isFinite(next) &&
                      next > 0 &&
                      Number.isFinite(currentPrice) &&
                      currentPrice > 0
                    ) {
                      if (Math.abs(next - currentPrice) / currentPrice >= 1e-6) {
                        setBuyToken(buyTokenForTarget(next, currentPrice));
                      }
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  placeholder={formatPriceLabel(currentPrice) || "0"}
                />
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-r-lg border-l p-0.5",
                    toggleClass,
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={buyToken === 0}
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
                    aria-pressed={buyToken === 1}
                    onClick={() => setBuyToken(1)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                      buyToken === 1 ? activeToggleClass : "text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    {symbol1}
                  </button>
                </span>
              </span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Buy {buySymbol} by selling {sellSymbol} · prices in {symbol1} per {symbol0}
            </p>
            {sharedError ? <p className="mt-2 text-[11px] text-rose-300/90">{sharedError}</p> : null}

            <div className="mt-4 border-t border-white/10 pt-3">
              <div className={cn("mb-2 flex min-h-[2.75rem] flex-col justify-end", amountAlign)}>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">With portfolio</p>
                <p className="font-mono text-sm text-zinc-100">
                  {sharedError ? "—" : `Sell ${withLabel}`}
                </p>
              </div>

              <PriceRangeLine
                rangeLower={activeRange.lower}
                rangeUpper={activeRange.upper}
                currentPrice={currentPrice}
                projectedPrice={hasTarget ? targetPrice : undefined}
                onProjectedPriceChange={applyProjectedPrice}
                priceUnit={`${symbol1}/${symbol0}`}
                rangeTitle="Active tick spacing"
                accent={accent}
              />

              <div className={cn("mt-2 flex min-h-[2.75rem] flex-col justify-start", amountAlign)}>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Without portfolio</p>
                <p className="font-mono text-sm text-zinc-100">
                  {sharedError ? "—" : `Sell ${withoutLabel}`}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
