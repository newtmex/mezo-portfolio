"use client";

import { Activity, Radio, RefreshCw, WifiOff } from "lucide-react";

import type { WsConnectionState } from "@/lib/events/types";
import { cn } from "@/lib/utils";

const LABELS: Record<WsConnectionState, string> = {
  idle: "Idle",
  connecting: "Connecting WSS",
  connected: "Live WSS",
  reconnecting: "Reconnecting",
  error: "WSS error",
};

export function ConnectionStatus({ state }: { state: WsConnectionState }) {
  const Icon =
    state === "connected"
      ? Radio
      : state === "reconnecting" || state === "connecting"
        ? RefreshCw
        : state === "error"
          ? WifiOff
          : Activity;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        state === "connected" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        (state === "connecting" || state === "reconnecting") &&
          "border-amber-500/40 bg-amber-500/10 text-amber-200",
        state === "error" && "border-rose-500/40 bg-rose-500/10 text-rose-300",
        state === "idle" && "border-white/10 bg-white/5 text-zinc-400",
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          (state === "connecting" || state === "reconnecting") && "animate-spin",
        )}
      />
      {LABELS[state]}
    </span>
  );
}
