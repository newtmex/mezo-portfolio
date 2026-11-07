"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { ClPositionsTable } from "@/components/cl-positions-table";
import type { ManagerClPositionValue } from "@/lib/report/types";
import { cn, formatUsd } from "@/lib/utils";

export function ClPositionsButton({
  rows,
  total,
  title,
  subtitle,
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
  priceUnit?: string;
  decimals0?: number;
  decimals1?: number;
  accent?: "amber" | "sky";
}) {
  const count = rows.length;
  const borderClass =
    accent === "sky"
      ? "border-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/15"
      : "border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
            borderClass,
          )}
        >
          CL {count > 0 ? `(${count}) ` : ""}
          {formatUsd(total)}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(92vw,44rem)] rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl outline-none"
        >
          <ClPositionsTable
            rows={rows}
            total={total}
            title={title}
            subtitle={subtitle}
            currentTick={currentTick}
            currentPrice={currentPrice}
            priceUnit={priceUnit}
            decimals0={decimals0}
            decimals1={decimals1}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
