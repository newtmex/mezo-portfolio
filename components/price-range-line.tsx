import { cn } from "@/lib/utils";

function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "n/a";
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toPrecision(6);
  return value.toPrecision(6);
}

function priceToPct(price: number, low: number, high: number): number {
  if (!(high > low) || !Number.isFinite(price)) return 0.5;
  return Math.max(0, Math.min(1, (price - low) / (high - low)));
}

export function PriceRangeLine({
  rangeLower,
  rangeUpper,
  currentPrice,
  priceUnit,
  accent = "amber",
  compact = false,
  className,
}: {
  rangeLower: number;
  rangeUpper: number;
  currentPrice?: number;
  priceUnit?: string;
  accent?: "amber" | "sky";
  compact?: boolean;
  className?: string;
}) {
  const lower = Math.min(rangeLower, rangeUpper);
  const upper = Math.max(rangeLower, rangeUpper);
  const spot =
    currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPrice
      : (lower + upper) / 2;
  const lo = Math.min(lower, upper, spot);
  const hi = Math.max(lower, upper, spot);
  const pad = Math.max((hi - lo) * 0.22, spot * 0.04, Number.EPSILON);
  const axisLow = Math.max(lo - pad, 0);
  const axisHigh = hi + pad;
  const activeLeft = priceToPct(lower, axisLow, axisHigh);
  const activeRight = priceToPct(upper, axisLow, axisHigh);
  const activeWidth = Math.max(activeRight - activeLeft, 0.004);
  const currentPct = priceToPct(spot, axisLow, axisHigh);
  const inRange = spot >= lower && spot < upper;

  const thinLineClass = accent === "sky" ? "bg-sky-400/35" : "bg-amber-400/35";
  const activeRangeClass =
    accent === "sky"
      ? "bg-gradient-to-r from-sky-400/80 via-sky-300 to-sky-400/80"
      : "bg-gradient-to-r from-amber-400/80 via-amber-300 to-amber-400/80";
  const markerClass = inRange
    ? accent === "sky"
      ? "bg-sky-100 shadow-[0_0_8px_rgba(186,230,253,0.75)]"
      : "bg-amber-100 shadow-[0_0_8px_rgba(254,243,199,0.75)]"
    : "bg-rose-300 shadow-[0_0_8px_rgba(252,165,165,0.55)]";

  return (
    <div className={cn("min-w-[12rem]", className)}>
      <div className={cn("relative mx-0.5", compact ? "h-10" : "h-14")}>
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full",
            thinLineClass,
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full",
            compact ? "h-2.5" : "h-3",
            activeRangeClass,
          )}
          style={{ left: `${activeLeft * 100}%`, width: `${activeWidth * 100}%` }}
          title={`Range ${formatPrice(lower)} → ${formatPrice(upper)}${priceUnit ? ` ${priceUnit}` : ""}`}
        />
        {currentPrice != null && Number.isFinite(currentPrice) ? (
          <div
            className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${currentPct * 100}%` }}
            title={`Current ${formatPrice(currentPrice)}${priceUnit ? ` ${priceUnit}` : ""}`}
          >
            <div
              className={cn(
                "w-[2px] rounded-full",
                compact ? "h-7" : "h-8",
                markerClass,
              )}
            />
            {!compact ? (
              <div className="pointer-events-none absolute bottom-[calc(50%+0.35rem)] right-[calc(50%+0.3rem)] flex w-max flex-col items-end text-right leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-200">
                  Current
                </span>
                <span className="font-mono text-[11px] text-zinc-100">
                  {formatPrice(currentPrice)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-0.5 flex justify-between gap-2 font-mono text-[10px] text-zinc-500">
        <span>{formatPrice(lower)}</span>
        <span className="text-zinc-600">{priceUnit ?? ""}</span>
        <span>{formatPrice(upper)}</span>
      </div>
    </div>
  );
}
