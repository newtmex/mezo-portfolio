import { formatUnits, type Address, type PublicClient } from "viem";

import { erc20Abi, gaugeAbi } from "../abis";
import { getHttpClient } from "../clients";
import {
  getManagerAddress,
  MEZO_CHAIN_ID,
  PAIRS,
  TRACKED_TOKENS,
} from "../config";
import {
  buildClRangeDepthReport,
  collectManagerPoolPositions,
  readManagerTokenHoldings,
} from "./manager-liquidity";
import { fetchMezoPriceMapMusd, lookupPriceMusd } from "./mezo-prices";
import { resolveMostLiquidClPool } from "./pools";
import type { ClRangeDepthReport, ManagerRangeDepthPayload } from "./types";

export async function buildManagerRangeDepthReport(input?: {
  client?: PublicClient;
  manager?: Address;
}): Promise<ManagerRangeDepthPayload> {
  const client = input?.client ?? getHttpClient();
  const manager = input?.manager ?? getManagerAddress();
  const prices = await fetchMezoPriceMapMusd();

  const pairSnapshots = await Promise.all(
    PAIRS.map(async (pair) => ({
      pair,
      pool: await resolveMostLiquidClPool(
        client,
        pair.tokenA,
        pair.tokenB,
        pair.label,
        pair.knownPool,
      ),
    })),
  );

  const rewardRates = await Promise.all(
    pairSnapshots.map(async ({ pair }) => {
      if (!pair.knownGauge) return 0n;
      try {
        return await client.readContract({
          address: pair.knownGauge,
          abi: gaugeAbi,
          functionName: "rewardRate",
        });
      } catch {
        return 0n;
      }
    }),
  );
  const mezoPerDay = rewardRates.reduce(
    (total, rate) => total + Number(formatUnits(rate, 18)) * 86_400,
    0,
  );
  const mezoPrice = lookupPriceMusd(prices, TRACKED_TOKENS[1].address, "MEZO");

  const reports = await Promise.all(
    pairSnapshots.map(({ pair, pool }) =>
      buildClRangeDepthReport({ client, pairLabel: pair.label, pool, managerAddress: manager }),
    ),
  );

  const [tokenHoldings, ...positionGroups] = await Promise.all([
    readManagerTokenHoldings({
      client,
      manager,
      tokens: TRACKED_TOKENS.map((token) => ({
        symbol: token.symbol,
        address: token.address,
      })),
      prices,
    }),
    ...pairSnapshots.map(async ({ pair, pool }, index) => {
      const report = reports[index];
      const [decimals0, decimals1] = await Promise.all([
        client.readContract({
          address: pool.token0,
          abi: erc20Abi,
          functionName: "decimals",
        }),
        client.readContract({
          address: pool.token1,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]);
      return collectManagerPoolPositions({
        client,
        pool,
        pairLabel: pair.label,
        manager,
        symbol0: report.token0.symbol,
        symbol1: report.token1.symbol,
        decimals0: Number(decimals0),
        decimals1: Number(decimals1),
        prices,
      });
    }),
  ]);

  const clPositions = positionGroups.flat();

  const tokenTotalMusd = tokenHoldings.reduce(
    (sum, row) =>
      sum + (row.valueMusd != null && Number.isFinite(row.valueMusd) ? row.valueMusd : 0),
    0,
  );
  const clTotalMusd = clPositions.reduce(
    (sum, row) =>
      sum + (row.valueMusd != null && Number.isFinite(row.valueMusd) ? row.valueMusd : 0),
    0,
  );

  const summary = reports.map((report) => ({
    pair: report.pairLabel,
    managerActivePct: report.managerActiveLiquidityShare,
    managerActiveBps: report.managerActiveLiquidityShareBps,
    managerL: report.managerInRangeLiquidity,
    activeL: report.activeLiquidity,
    depthDiffToken0: report.priceMoveDepthDiff.sellToken0ToLeaveLower,
    depthDiffToken1: report.priceMoveDepthDiff.sellToken1ToLeaveUpper,
  }));

  return {
    network: "mainnet",
    chainId: MEZO_CHAIN_ID,
    manager,
    fetchedAt: new Date().toISOString(),
    holdings: {
      tokens: tokenHoldings,
      clPositions,
      tokenTotalMusd,
      clTotalMusd,
      portfolioTotalMusd: tokenTotalMusd + clTotalMusd,
    },
    summary,
    pools: reports,
    emissions: {
      mezoPerDay: Number.isFinite(mezoPerDay) ? mezoPerDay : null,
      valueMusdPerDay:
        mezoPrice != null && Number.isFinite(mezoPerDay) ? mezoPerDay * mezoPrice : null,
    },
  };
}

export async function buildPoolRangeDepthReport(
  key: (typeof PAIRS)[number]["key"],
  input?: { client?: PublicClient; manager?: Address },
): Promise<ClRangeDepthReport> {
  const pair = PAIRS.find((candidate) => candidate.key === key);
  if (!pair) throw new Error(`Unknown pool key: ${key}`);
  const client = input?.client ?? getHttpClient();
  const manager = input?.manager ?? getManagerAddress();
  const pool = await resolveMostLiquidClPool(
    client,
    pair.tokenA,
    pair.tokenB,
    pair.label,
    pair.knownPool,
  );
  return buildClRangeDepthReport({ client, pairLabel: pair.label, pool, managerAddress: manager });
}
