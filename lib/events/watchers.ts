"use client";

import { type Address, type Log, type PublicClient, parseAbiItem } from "viem";

import { createWsClient } from "../clients";
import { ADDRESSES, PAIRS, TRACKED_TOKENS } from "../config";
import type { LiveEventItem, LiveEventKind, WsConnectionState } from "./types";

type WatchHandlers = {
  onEvent: (event: LiveEventItem) => void;
  onState: (state: WsConnectionState) => void;
  onRefreshNeeded: (source?: string) => void;
};

const poolSwapEvent = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
);
const poolMintEvent = parseAbiItem(
  "event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
);
const poolBurnEvent = parseAbiItem(
  "event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
);
const erc20TransferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const nftTransferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);
const gaugeDepositEvent = parseAbiItem(
  "event Deposit(address indexed user, uint256 indexed tokenId, uint128 indexed liquidityToStake)",
);
const gaugeWithdrawEvent = parseAbiItem(
  "event Withdraw(address indexed user, uint256 indexed tokenId, uint128 indexed liquidityToStake)",
);

function makeId(log: Log): string {
  return `${log.transactionHash ?? "0x"}-${log.logIndex ?? 0}-${log.blockNumber ?? 0n}`;
}

function pushEvent(
  handlers: WatchHandlers,
  kind: LiveEventKind,
  source: string,
  summary: string,
  log: Log,
): void {
  if (!log.transactionHash) return;
  handlers.onEvent({
    id: makeId(log),
    kind,
    source,
    summary,
    txHash: log.transactionHash,
    blockNumber: (log.blockNumber ?? 0n).toString(),
    at: new Date().toISOString(),
  });
  handlers.onRefreshNeeded(source);
}

export type EventWatcherHandle = {
  stop: () => void;
};

/** Subscribe to manager/pool events over Mezo WSS and debounce refreshes. */
export function startManagerEventWatchers(
  manager: Address,
  handlers: WatchHandlers,
): EventWatcherHandle {
  const client: PublicClient = createWsClient();
  const unsubscribers: Array<() => void> = [];
  let stopped = false;
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const refresh = (source?: string) => {
    const key = source ?? "all";
    const existing = debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    debounceTimers.set(key, setTimeout(() => {
      debounceTimers.delete(key);
      if (!stopped) handlers.onRefreshNeeded(source);
    }, 600));
  };

  const wrapped: WatchHandlers = {
    onEvent: handlers.onEvent,
    onState: handlers.onState,
    onRefreshNeeded: refresh,
  };

  handlers.onState("connecting");

  const poolEntries = PAIRS.map((pair) => ({
    label: pair.label,
    address: pair.knownPool!,
    gauge: pair.knownGauge,
  })).filter((row) => Boolean(row.address));

  for (const pool of poolEntries) {
    unsubscribers.push(
      client.watchEvent({
        address: pool.address,
        event: poolSwapEvent,
        onLogs: (logs) => {
          handlers.onState("connected");
          for (const log of logs) {
            pushEvent(wrapped, "Swap", pool.label, `Pool swap on ${pool.label}`, log);
          }
        },
        onError: () => handlers.onState("reconnecting"),
      }),
    );
    unsubscribers.push(
      client.watchEvent({
        address: pool.address,
        event: poolMintEvent,
        onLogs: (logs) => {
          handlers.onState("connected");
          for (const log of logs) {
            pushEvent(wrapped, "Mint", pool.label, `Liquidity minted on ${pool.label}`, log);
          }
        },
        onError: () => handlers.onState("reconnecting"),
      }),
    );
    unsubscribers.push(
      client.watchEvent({
        address: pool.address,
        event: poolBurnEvent,
        onLogs: (logs) => {
          handlers.onState("connected");
          for (const log of logs) {
            pushEvent(wrapped, "Burn", pool.label, `Liquidity burned on ${pool.label}`, log);
          }
        },
        onError: () => handlers.onState("reconnecting"),
      }),
    );

    if (pool.gauge) {
      unsubscribers.push(
        client.watchEvent({
          address: pool.gauge,
          event: gaugeDepositEvent,
          args: { user: manager },
          onLogs: (logs) => {
            handlers.onState("connected");
            for (const log of logs) {
              pushEvent(
                wrapped,
                "Deposit",
                pool.label,
                `Manager deposited NFT into ${pool.label} gauge`,
                log,
              );
            }
          },
          onError: () => handlers.onState("reconnecting"),
        }),
      );
      unsubscribers.push(
        client.watchEvent({
          address: pool.gauge,
          event: gaugeWithdrawEvent,
          args: { user: manager },
          onLogs: (logs) => {
            handlers.onState("connected");
            for (const log of logs) {
              pushEvent(
                wrapped,
                "Withdraw",
                pool.label,
                `Manager withdrew NFT from ${pool.label} gauge`,
                log,
              );
            }
          },
          onError: () => handlers.onState("reconnecting"),
        }),
      );
    }
  }

  unsubscribers.push(
    client.watchEvent({
      address: ADDRESSES.npm,
      event: nftTransferEvent,
      args: { from: manager },
      onLogs: (logs) => {
        handlers.onState("connected");
        for (const log of logs) {
          pushEvent(wrapped, "Transfer", "NPM", "Manager transferred out a position NFT", log);
        }
      },
      onError: () => handlers.onState("reconnecting"),
    }),
  );
  unsubscribers.push(
    client.watchEvent({
      address: ADDRESSES.npm,
      event: nftTransferEvent,
      args: { to: manager },
      onLogs: (logs) => {
        handlers.onState("connected");
        for (const log of logs) {
          pushEvent(wrapped, "Transfer", "NPM", "Manager received a position NFT", log);
        }
      },
      onError: () => handlers.onState("reconnecting"),
    }),
  );
  for (const token of TRACKED_TOKENS) {
    unsubscribers.push(
      client.watchEvent({
        address: token.address,
        event: erc20TransferEvent,
        args: { from: manager },
        onLogs: (logs) => {
          handlers.onState("connected");
          for (const log of logs) {
            pushEvent(
              wrapped,
              "Transfer",
              token.symbol,
              `Manager sent ${token.symbol}`,
              log,
            );
          }
        },
        onError: () => handlers.onState("reconnecting"),
      }),
    );
    unsubscribers.push(
      client.watchEvent({
        address: token.address,
        event: erc20TransferEvent,
        args: { to: manager },
        onLogs: (logs) => {
          handlers.onState("connected");
          for (const log of logs) {
            pushEvent(
              wrapped,
              "Transfer",
              token.symbol,
              `Manager received ${token.symbol}`,
              log,
            );
          }
        },
        onError: () => handlers.onState("reconnecting"),
      }),
    );
  }

  // Mark connected once subscriptions are registered; individual onLogs confirm activity.
  handlers.onState("connected");

  return {
    stop: () => {
      stopped = true;
      for (const timer of debounceTimers.values()) clearTimeout(timer);
      for (const unsub of unsubscribers) {
        try {
          unsub();
        } catch {
          // ignore
        }
      }
      handlers.onState("idle");
    },
  };
}
