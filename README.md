# Aurove Admin — Manager Range Depth

Standalone Next.js dashboard that reports the same data as:

```bash
pnpm ops manage manager-range-depth mainnet
```

It listens to Mezo mainnet events over WebSocket RPC (`wss://mezo-mainnet.boar.network`) and refreshes when manager/pool state changes.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- viem (HTTP reads + WSS event subscriptions)
- TanStack Query

## Setup

```bash
# from repo root
cp admin/.env.example admin/.env.local
# set MANAGER_ADDRESS / NEXT_PUBLIC_MANAGER_ADDRESS

pnpm install
pnpm dev:admin
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001).

## Env

| Variable | Purpose |
|---|---|
| `MANAGER_ADDRESS` | Server-side manager wallet |
| `NEXT_PUBLIC_MANAGER_ADDRESS` | Client event filters (same address) |
| `MEZO_RPC_HTTP` / `NEXT_PUBLIC_MEZO_RPC_HTTP` | HTTPS JSON-RPC |
| `MEZO_RPC_WSS` / `NEXT_PUBLIC_MEZO_RPC_WSS` | WebSocket JSON-RPC |
| `MEZO_API_BASE_URL` | Mezo prices API (`/tokens`, `/pools`) |

No private keys are used by this app.

## Scripts

```bash
pnpm --filter @aurove/admin dev
pnpm --filter @aurove/admin typecheck
pnpm --filter @aurove/admin test
pnpm --filter @aurove/admin build
```

## What it shows

- Portfolio / token / CL totals (Mezo API mUSD prices)
- Per-pool tight-range depth for `MUSD/avBTCm`, `MEZO/MUSD`, `MEZO/BTC`, `avBTCm/avMEZOm`
- Manager active liquidity % and price-move depth Δ %
- Manager wallet balances and CL NFT positions (wallet + gauge-staked)
- Live activity feed driven by WSS subscriptions
