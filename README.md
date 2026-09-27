# Portfolio Dashboard — Range Depth

Standalone Next.js dashboard for monitoring a Mezo mainnet portfolio across concentrated-liquidity pools.

It displays portfolio totals, token balances, CL positions, pool range depth, active-liquidity share, price-move depth, and recent on-chain activity.

## Behavior

- Covers `MUSD/avBTCm`, `MEZO/MUSD`, `MEZO/BTC`, and `avBTCm/avMEZOm`.
- Shows token balances and CL positions in portfolio dropdowns beside the wallet address.
- Keeps live activity hidden by default in a foldable right-side panel.
- Does not poll automatically. Data refreshes after watched on-chain events, including swaps, liquidity changes, token transfers, NFT transfers, and gauge deposits/withdrawals.
- Refreshes the affected pool and portfolio valuation after pool events; wallet and position events refresh the portfolio report.
- Uses Mezo API prices for standard tokens and derives `avBTCm`/`avMEZOm` prices from the configured Aurove CL pools when the API does not provide wrapper prices.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- viem for Mezo HTTP RPC and WebSocket subscriptions
- TanStack Query for event-triggered data invalidation
- Radix UI for accessible portfolio dropdowns

## Setup

```bash
# from repo root
cp admin/.env.example admin/.env.local
# set MANAGER_ADDRESS and NEXT_PUBLIC_MANAGER_ADDRESS

pnpm install
pnpm dev:admin
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001).

## Environment variables

| Variable | Purpose |
|---|---|
| `MANAGER_ADDRESS` | Server-side portfolio wallet address |
| `NEXT_PUBLIC_MANAGER_ADDRESS` | Client-side wallet address used for event filters |
| `MEZO_RPC_HTTP` / `NEXT_PUBLIC_MEZO_RPC_HTTP` | Mezo HTTPS JSON-RPC endpoint |
| `MEZO_RPC_WSS` / `NEXT_PUBLIC_MEZO_RPC_WSS` | Mezo WebSocket endpoint for live events |
| `MEZO_POOLS_API_BASE_URL` | Optional Mezo pools API base URL override |
| `MEZO_API_BASE_URL` | Optional Mezo API base URL override |
| `NEXT_PUBLIC_MEZO_API_BASE_URL` | Optional browser-visible API base URL override |
| `NEXT_PUBLIC_MEZO_EXPLORER` | Optional Mezo explorer URL override |

The default API base is `https://api.mezo.org`; the default RPC endpoints use `mezo-mainnet.boar.network`. No private keys are used.

## Commands

```bash
pnpm --filter @aurove/admin dev
pnpm --filter @aurove/admin typecheck
pnpm --filter @aurove/admin test
pnpm --filter @aurove/admin build
```
