"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn } from "@/lib/utils";

export function formatPriceLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "n/a";
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toPrecision(6);
  return value.toPrecision(6);
}

function priceToPct(price: number, low: number, high: number): number {
  if (!(high > low) || !Number.isFinite(price)) return 0.5;
  return Math.max(0, Math.min(1, (price - low) / (high - low)));
}

function pctToPrice(pct: number, low: number, high: number): number {
  const clamped = Math.max(0, Math.min(1, pct));
  return low + clamped * (high - low);
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
      <div
        className={cn(
          "relative flex h-10 w-6 items-center justify-center",
          draggable && "active:cursor-ew-resize",
        )}
      >
        <div className={cn("h-8 w-[2px] rounded-full", lineClass)} />
      </div>
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

export function PriceRangeLine({
  rangeLower,
  rangeUpper,
  currentPrice,
  projectedPrice,
  onProjectedPriceChange,
  priceUnit,
  rangeTitle = "Range",
  accent = "amber",
  className,
}: {
  rangeLower: number;
  rangeUpper: number;
  currentPrice: number;
  /** When set with `onProjectedPriceChange`, enables projected marker + drag. */
  projectedPrice?: number;
  onProjectedPriceChange?: (price: number) => void;
  priceUnit?: string;
  rangeTitle?: string;
  accent?: "amber" | "sky";
  className?: string;
}) {
  const interactive = typeof onProjectedPriceChange === "function";
  const [dragging, setDragging] = useState(false);
  const [lockedAxis, setLockedAxis] = useState<{ low: number; high: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const lower = Math.min(rangeLower, rangeUpper);
  const upper = Math.max(rangeLower, rangeUpper);
  const spot =
    Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : (lower + upper) / 2;
  const hasProjected =
    projectedPrice != null && Number.isFinite(projectedPrice) && projectedPrice > 0;
  const projected = hasProjected ? projectedPrice! : spot;

  const fittedAxis = useMemo(() => {
    const lo = Math.min(spot, projected, lower);
    const hi = Math.max(spot, projected, upper);
    const pad = Math.max((hi - lo) * 0.22, spot * 0.04, Number.EPSILON);
    return {
      low: Math.max(lo - pad, 0),
      high: hi + pad,
    };
  }, [spot, projected, lower, upper]);

  const axisBounds = lockedAxis ?? fittedAxis;

  const axis = useMemo(() => {
    const activeLeft = priceToPct(lower, axisBounds.low, axisBounds.high);
    const activeRight = priceToPct(upper, axisBounds.low, axisBounds.high);
    return {
      low: axisBounds.low,
      high: axisBounds.high,
      currentPct: priceToPct(spot, axisBounds.low, axisBounds.high),
      projectedPct: priceToPct(projected, axisBounds.low, axisBounds.high),
      activeLeft,
      activeWidth: Math.max(activeRight - activeLeft, 0.004),
      nearSpot: Math.abs(projected - spot) / Math.max(spot, Number.EPSILON) < 1e-6,
    };
  }, [spot, projected, lower, upper, axisBounds]);

  const moveLeft = Math.min(axis.currentPct, axis.projectedPct);
  const moveWidth = Math.abs(axis.projectedPct - axis.currentPct);

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

  const beginDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      captureTarget: HTMLDivElement,
      stopPropagation: boolean,
    ) => {
      if (!interactive || !onProjectedPriceChange) return;
      if (event.button !== 0) return;
      event.preventDefault();
      if (stopPropagation) event.stopPropagation();

      const bounds = { ...fittedAxis };
      setLockedAxis(bounds);
      setDragging(true);
      captureTarget.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const price = priceFromClientX(moveEvent.clientX, bounds);
        if (price != null) onProjectedPriceChange(price);
      };
      const onUp = (upEvent: PointerEvent) => {
        captureTarget.releasePointerCapture(upEvent.pointerId);
        captureTarget.removeEventListener("pointermove", onMove);
        captureTarget.removeEventListener("pointerup", onUp);
        captureTarget.removeEventListener("pointercancel", onUp);
        endDrag();
      };

      captureTarget.addEventListener("pointermove", onMove);
      captureTarget.addEventListener("pointerup", onUp);
      captureTarget.addEventListener("pointercancel", onUp);

      const initial = priceFromClientX(event.clientX, bounds);
      if (initial != null) onProjectedPriceChange(initial);
    },
    [interactive, onProjectedPriceChange, fittedAxis, priceFromClientX, endDrag],
  );

  const thinLineClass = accent === "sky" ? "bg-sky-400/35" : "bg-amber-400/35";
  const activeRangeClass =
    accent === "sky"
      ? "bg-gradient-to-r from-sky-400/80 via-sky-300 to-sky-400/80"
      : "bg-gradient-to-r from-amber-400/80 via-amber-300 to-amber-400/80";
  const moveClass = accent === "sky" ? "bg-sky-200/70" : "bg-amber-200/70";

  return (
    <div className={cn("min-w-[12rem]", className)}>
      <div
        ref={trackRef}
        className={cn(
          "relative mx-1 h-14",
          interactive && "touch-none",
          interactive && (dragging ? "cursor-ew-resize" : "cursor-pointer"),
        )}
        onPointerDown={
          interactive
            ? (event) => beginDrag(event, event.currentTarget, false)
            : undefined
        }
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
          title={`${rangeTitle} · ${formatPriceLabel(lower)} → ${formatPriceLabel(upper)}${priceUnit ? ` ${priceUnit}` : ""}`}
        />
        {interactive && hasProjected && !axis.nearSpot ? (
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
          priceLabel={formatPriceLabel(spot)}
          tone="current"
          accent={accent}
        />
        {interactive && hasProjected ? (
          <PriceMarker
            pct={axis.projectedPct}
            label="Projected"
            priceLabel={formatPriceLabel(projected)}
            tone="projected"
            accent={accent}
            draggable
            onPointerDown={(event) => beginDrag(event, event.currentTarget, true)}
          />
        ) : null}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
        <span>{formatPriceLabel(axis.low)}</span>
        <span>{priceUnit ?? ""}</span>
        <span>{formatPriceLabel(axis.high)}</span>
      </div>
    </div>
  );
}
