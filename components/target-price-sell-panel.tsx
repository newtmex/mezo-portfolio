"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown } from "lucide-react";
import { formatUnits } from "viem";

import {
  type BuyToken,
  humanPriceToken1PerToken0,
  sellAmountToReachHumanPrice,
  type SellToTargetResult,
} from "@/lib/math/price";
import { sqrtRatioAtTick } from "@/lib/math/tick-math";
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
  if (numeric === 0) return `0 ${symbol}`;
  const formatted = Math.abs(numeric) < 1 ? formatAmount(human, 5) : numeric.toFixed(2);
  return `${formatted} ${symbol}`;
}

function amountLabel(result: SellToTargetResult, decimals: number, symbol: string): string {
  if (!result.ok) return "—";
  return formatSellAmount(result.amountRaw, decimals, symbol);
}

/** Map a price onto [0, 1] across a padded [low, high] window. */
function priceToPct(price: number, low: number, high: number): number {
  if (!(high > low) || !Number.isFinite(price)) return 0.5;
  return Math.max(0, Math.min(1, (price - low) / (high - low)));
}

function pctToPrice(pct: number, low: number, high: number): number {
  const clamped = Math.max(0, Math.min(1, pct));
  return low + clamped * (high - low);
}

function buyTokenForTarget(target: number, spot: number): BuyToken {
  return target < spot ? 1 : 0;
}

function PriceMarker({
  pct,
  label,
  priceLabel,
  tone,
  accent,
  draggable,
  onPointerDown,
}: {
  pct: number;
  label: string;
  priceLabel: string;
  tone: "current" | "projected";
  accent: "amber" | "sky";
  draggable?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const isCurrent = tone === "current";
  const lineClass = isCurrent
    ? accent === "sky"
      ? "bg-sky-100 shadow-[0_0_10px_rgba(186,230,253,0.75)]"
      : "bg-amber-100 shadow-[0_0_10px_rgba(254,243,199,0.75)]"
    : accent === "sky"
      ? "bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.55)]"
      : "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.55)]";

  return (
    <div
      className={cn(
        "absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2",
        draggable && "cursor-ew-resize touch-none select-none",
      )}
      style={{ left: `${pct * 100}%` }}
      onPointerDown={onPointerDown}
      title={draggable ? "Drag to set projected price" : undefined}
    >
      {/* Vertical price marker with a larger drag hit target */}
      <div
        className={cn(
          "relative flex h-10 w-6 items-center justify-center",
          draggable && "active:cursor-ew-resize",
        )}
      >
        <div className={cn("h-8 w-[2px] rounded-full", lineClass)} />
      </div>
      {/* Label sits beside the pointer, tucked against the range line */}
      <div
        className={cn(
          "pointer-events-none absolute flex w-max flex-col leading-tight",
          isCurrent
            ? "bottom-[calc(50%+0.35rem)] right-[calc(50%+0.3rem)] items-end text-right"
            : "top-[calc(50%+0.35rem)] left-[calc(50%+0.3rem)] items-start text-left",
        )}
      >
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            isCurrent ? "text-zinc-200" : accent === "sky" ? "text-sky-200" : "text-amber-200",
          )}
        >
          {label}
        </span>
        <span className="font-mono text-[11px] text-zinc-100">{priceLabel}</span>
      </div>
    </div>
  );
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
    const lower = humanPriceToken1PerToken0(
      sqrtRatioAtTick(tickLower),
      decimals0,
      decimals1,
    );
    const upper = humanPriceToken1PerToken0(
      sqrtRatioAtTick(tickUpper),
      decimals0,
      decimals1,
    );
    return {
      lower: Math.min(lower, upper),
      upper: Math.max(lower, upper),
    };
  }, [tickLower, tickUpper, decimals0, decimals1]);

  const [buyToken, setBuyToken] = useState<BuyToken>(1);
  const [targetInput, setTargetInput] = useState(() => formatPriceInput(currentPrice));
  const [priceUnitOpen, setPriceUnitOpen] = useState(false);
  const priceUnitId = useId();
  const [dragging, setDragging] = useState(false);
  const [lockedAxis, setLockedAxis] = useState<{ low: number; high: number } | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);
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

  const fittedAxis = useMemo(() => {
    const spot = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : 1;
    const projected = hasTarget ? targetPrice : spot;
    const lo = Math.min(spot, projected, activeRange.lower);
    const hi = Math.max(spot, projected, activeRange.upper);
    const pad = Math.max((hi - lo) * 0.22, spot * 0.04, Number.EPSILON);
    return {
      low: Math.max(lo - pad, 0),
      high: hi + pad,
    };
  }, [currentPrice, targetPrice, hasTarget, activeRange]);

  const axisBounds = lockedAxis ?? fittedAxis;

  const axis = useMemo(() => {
    const spot = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : 1;
    const projected = hasTarget ? targetPrice : spot;
    const activeLeft = priceToPct(activeRange.lower, axisBounds.low, axisBounds.high);
    const activeRight = priceToPct(activeRange.upper, axisBounds.low, axisBounds.high);
    return {
      low: axisBounds.low,
      high: axisBounds.high,
      currentPct: priceToPct(spot, axisBounds.low, axisBounds.high),
      projectedPct: priceToPct(projected, axisBounds.low, axisBounds.high),
      activeLeft,
      activeWidth: Math.max(activeRight - activeLeft, 0.004),
      movingLower: projected < spot,
      nearSpot: Math.abs(projected - spot) / spot < 1e-6,
    };
  }, [currentPrice, targetPrice, hasTarget, axisBounds, activeRange]);

  const moveLeft = Math.min(axis.currentPct, axis.projectedPct);
  const moveWidth = Math.abs(axis.projectedPct - axis.currentPct);

  const applyProjectedPrice = useCallback((price: number) => {
    const spot = spotRef.current;
    if (!(price > 0) || !Number.isFinite(price)) return;
    // Keep a tiny gap from exact spot so sell math stays directional.
    const minGap = Math.max(spot * 1e-6, Number.EPSILON);
    let next = price;
    if (Math.abs(next - spot) < minGap) {
      next = buyTokenRef.current === 1 ? spot - minGap : spot + minGap;
    }
    if (next <= 0) next = minGap;

    setTargetInput(formatPriceInput(next));
    const nextBuy = buyTokenForTarget(next, spot);
    if (nextBuy !== buyTokenRef.current) {
      buyTokenRef.current = nextBuy;
      setBuyToken(nextBuy);
    }
  }, []);

  const priceFromClientX = useCallback(
    (clientX: number, bounds: { low: number; high: number }) => {
      const track = trackRef.current;
      if (!track) return null;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const pct = (clientX - rect.left) / rect.width;
      const price = pctToPrice(pct, bounds.low, bounds.high);
      return price > 0 ? price : null;
    },
    [],
  );

  const endDrag = useCallback(() => {
    setDragging(false);
    setLockedAxis(null);
  }, []);

  const onProjectedPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const bounds = { ...fittedAxis };
      setLockedAxis(bounds);
      setDragging(true);

      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const price = priceFromClientX(moveEvent.clientX, bounds);
        if (price != null) applyProjectedPrice(price);
      };
      const onUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId);
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        target.removeEventListener("pointercancel", onUp);
        endDrag();
      };

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
      target.addEventListener("pointercancel", onUp);

      const initial = priceFromClientX(event.clientX, bounds);
      if (initial != null) applyProjectedPrice(initial);
    },
    [fittedAxis, priceFromClientX, applyProjectedPrice, endDrag],
  );

  /** Click / drag anywhere on the track to place the projected point. */
  const onTrackPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      // Ignore if the event started on the projected marker (it stops propagation).
      event.preventDefault();

      const bounds = { ...fittedAxis };
      setLockedAxis(bounds);
      setDragging(true);

      const track = event.currentTarget;
      track.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const price = priceFromClientX(moveEvent.clientX, bounds);
        if (price != null) applyProjectedPrice(price);
      };
      const onUp = (upEvent: PointerEvent) => {
        track.releasePointerCapture(upEvent.pointerId);
        track.removeEventListener("pointermove", onMove);
        track.removeEventListener("pointerup", onUp);
        track.removeEventListener("pointercancel", onUp);
        endDrag();
      };

      track.addEventListener("pointermove", onMove);
      track.addEventListener("pointerup", onUp);
      track.addEventListener("pointercancel", onUp);

      const initial = priceFromClientX(event.clientX, bounds);
      if (initial != null) applyProjectedPrice(initial);
    },
    [fittedAxis, priceFromClientX, applyProjectedPrice, endDrag],
  );

  const toggleClass =
    accent === "sky"
      ? "border-sky-400/30 bg-sky-400/10 text-sky-100"
      : "border-amber-400/30 bg-amber-400/10 text-amber-100";
  const activeToggleClass =
    accent === "sky"
      ? "bg-sky-400/25 text-sky-50"
      : "bg-amber-400/25 text-amber-50";
  const thinLineClass =
    accent === "sky" ? "bg-sky-400/35" : "bg-amber-400/35";
  const activeRangeClass =
    accent === "sky"
      ? "bg-gradient-to-r from-sky-400/80 via-sky-300 to-sky-400/80"
      : "bg-gradient-to-r from-amber-400/80 via-amber-300 to-amber-400/80";
  const moveClass =
    accent === "sky" ? "bg-sky-200/70" : "bg-amber-200/70";

  const amountAlign = axis.movingLower ? "items-start text-left" : "items-end text-right";

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
                    if (Number.isFinite(next) && next > 0 && Number.isFinite(currentPrice) && currentPrice > 0) {
                      if (Math.abs(next - currentPrice) / currentPrice >= 1e-6) {
                        setBuyToken(buyTokenForTarget(next, currentPrice));
                      }
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  placeholder={formatPriceInput(currentPrice) || "0"}
                />
                <span className={cn("inline-flex shrink-0 items-center rounded-r-lg border-l p-0.5", toggleClass)}>
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

              <div
                ref={trackRef}
                className={cn(
                  "relative mx-1 h-14 touch-none",
                  dragging ? "cursor-ew-resize" : "cursor-pointer",
                )}
                onPointerDown={onTrackPointerDown}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full",
                    thinLineClass,
                  )}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute top-1/2 h-3 -translate-y-1/2 rounded-full",
                    activeRangeClass,
                  )}
                  style={{ left: `${axis.activeLeft * 100}%`, width: `${axis.activeWidth * 100}%` }}
                  title={`Active tick spacing · ${formatPriceInput(activeRange.lower)} → ${formatPriceInput(activeRange.upper)}`}
                />
                {!axis.nearSpot && hasTarget ? (
                  <div
                    className={cn(
                      "pointer-events-none absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full",
                      moveClass,
                    )}
                    style={{ left: `${moveLeft * 100}%`, width: `${Math.max(moveWidth * 100, 0.5)}%` }}
                  />
                ) : null}

                <PriceMarker
                  pct={axis.currentPct}
                  label="Current"
                  priceLabel={formatPriceInput(currentPrice) || "n/a"}
                  tone="current"
                  accent={accent}
                />
                {hasTarget ? (
                  <PriceMarker
                    pct={axis.projectedPct}
                    label="Projected"
                    priceLabel={formatPriceInput(targetPrice) || "n/a"}
                    tone="projected"
                    accent={accent}
                    draggable
                    onPointerDown={onProjectedPointerDown}
                  />
                ) : null}
              </div>

              <div className={cn("mt-2 flex min-h-[2.75rem] flex-col justify-start", amountAlign)}>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Without portfolio</p>
                <p className="font-mono text-sm text-zinc-100">
                  {sharedError ? "—" : `Sell ${withoutLabel}`}
                </p>
              </div>

              <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
                <span>{formatPriceInput(axis.low)}</span>
                <span>{symbol1}/{symbol0}</span>
                <span>{formatPriceInput(axis.high)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
