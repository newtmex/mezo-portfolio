import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, size = 4): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatAmount(value: string | number, digits = 6): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  if (Math.abs(num) >= 1_000_000) return num.toExponential(3);
  if (num !== 0 && Math.abs(num) < 0.001) {
    const raw = typeof value === "string" ? value : num.toString();
    const negative = raw.startsWith("-");
    const fraction = raw.replace(/^[+-]?\d*\.?/, "");
    const zeroCount = fraction.match(/^0*/)?.[0].length ?? 0;
    const significant = fraction.slice(zeroCount, zeroCount + 5);
    if (significant) {
      const subscript = String(zeroCount)
        .split("")
        .map((digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)])
        .join("");
      return `${negative ? "-" : ""}0.0${subscript}${significant}`;
    }
  }
  return num.toPrecision(digits);
}

export function explorerAddressUrl(explorer: string, address: string): string {
  return `${explorer.replace(/\/$/, "")}/address/${address}`;
}

export function explorerTxUrl(explorer: string, hash: string): string {
  return `${explorer.replace(/\/$/, "")}/tx/${hash}`;
}
