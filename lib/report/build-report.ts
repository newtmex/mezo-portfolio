import { formatUnits, getAddress, type Address, type PublicClient } from "viem";

import { erc20Abi, gaugeAbi } from "../abis";
import { getHttpClient } from "../clients";
import { ADDRESSES, getManagerAddress, MEZO_CHAIN_ID, PAIRS, TRACKED_TOKENS } from "../config";
import {
  buildClRangeDepthReport,
  collectManagerPoolPositions,
  readManagerTokenHoldings,
} from "./manager-liquidity";
import { activeLiquidityAprPercent } from "./apr";
import { fetchMezoPriceMapMusd, lookupPriceMusd } from "./mezo-prices";
import { resolveMostLiquidClPool } from "./pools";
import type { ClRangeDepthReport, ManagerRangeDepthPayload } from "./types";

async function readPoolTvlMusd(input: {
  client: PublicClient;
  pool: {
    address: Address;
    token0: Address;
    token1: Address;
  };
  prices: ReadonlyMap<string, number>;
}): Promise<number | null> {
  const [balance0, balance1, decimals0, decimals1] = await Promise.all([
    input.client.readContract({
      address: input.pool.token0,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [input.pool.address],
    }),
    input.client.readContract({
      address: input.pool.token1,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [input.pool.address],
    }),
    input.client.readContract({
      address: input.pool.token0,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    input.client.readContract({
      address: input.pool.token1,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);
  const price0 = lookupPriceMusd(input.prices, input.pool.token0);
  const price1 = lookupPriceMusd(input.prices, input.pool.token1);
  if (price0 == null || price1 == null) return null;
  const value0 = Number(formatUnits(balance0, decimals0)) * price0;
  const value1 = Number(formatUnits(balance1, decimals1)) * price1;
  const total = value0 + value1;
  return Number.isFinite(total) && total > 0 ? total : null;
}

async function readLiveGaugeRewardRate(
  client: PublicClient,
  gauge: Address,
  timestamp: bigint,
): Promise<bigint> {
  const [rewardRate, periodFinish, rewardToken] = await Promise.all([
    client.readContract({ address: gauge, abi: gaugeAbi, functionName: "rewardRate" }),
    client.readContract({ address: gauge, abi: gaugeAbi, functionName: "periodFinish" }),
    client.readContract({ address: gauge, abi: gaugeAbi, functionName: "rewardToken" }),
  ]);
  if (getAddress(rewardToken) !== ADDRESSES.mezo || periodFinish <= timestamp) return 0n;
  return rewardRate;
}

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

  const latestBlock = await client.getBlock();
  const gaugePools = pairSnapshots.map(({ pool }) => pool).filter((pool) => pool.gauge);
  const gaugeCalls = gaugePools.flatMap((pool) => [
    { address: pool.gauge, abi: gaugeAbi, functionName: "rewardRate" as const },
    { address: pool.gauge, abi: gaugeAbi, functionName: "periodFinish" as const },
    { address: pool.gauge, abi: gaugeAbi, functionName: "rewardToken" as const },
  ]);
  const gaugeResults = await client.multicall({ contracts: gaugeCalls, allowFailure: true });
  const aggregateEmissionRates = gaugePools.map((_, index) => {
    const results = gaugeResults.slice(index * 3, index * 3 + 3);
    if (results.some((result) => result.status === "failure")) return 0n;
    const [rewardRate, periodFinish, rewardToken] = results.map((result) => result.result) as [
      bigint,
      bigint,
      Address,
    ];
    if (getAddress(rewardToken) !== ADDRESSES.mezo || periodFinish <= latestBlock.timestamp) {
      return 0n;
    }
    return rewardRate;
  });

  const rewardRatesByGauge = new Map(
    gaugePools.map((pool, index) => [
      pool.gauge.toLowerCase(),
      aggregateEmissionRates[index] ?? 0n,
    ]),
  );
  const mezoPrice = lookupPriceMusd(prices, TRACKED_TOKENS[1].address, "MEZO");

  const reports = await Promise.all(
    pairSnapshots.map(async ({ pair, pool }) => {
      const [report, poolTvlMusd] = await Promise.all([
        buildClRangeDepthReport({
          client,
          pairLabel: pair.label,
          pool,
          managerAddress: manager,
        }),
        readPoolTvlMusd({ client, pool, prices }),
      ]);
      return {
        ...report,
        activeLiquidityApr: activeLiquidityAprPercent({
          rewardRate: rewardRatesByGauge.get(pool.gauge.toLowerCase()) ?? 0n,
          mezoPriceMusd: mezoPrice,
          poolTvlMusd,
          activeLiquidity: pool.liquidity,
          stakedLiquidity: pool.stakedLiquidity,
        }),
      };
    }),
  );

  const mezoPerDay = gaugePools.reduce((total, pool, index) => {
    const report = reports.find((candidate) => candidate.gauge === pool.gauge);
    const activeShareBps = report?.managerStakedActiveLiquidityShareBps;
    if (activeShareBps == null) return total;
    const accountRate = (aggregateEmissionRates[index] * BigInt(activeShareBps)) / 10_000n;
    return total + Number(formatUnits(accountRate, 18)) * 86_400;
  }, 0);
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
  const [prices, latestBlock] = await Promise.all([fetchMezoPriceMapMusd(), client.getBlock()]);
  const pool = await resolveMostLiquidClPool(
    client,
    pair.tokenA,
    pair.tokenB,
    pair.label,
    pair.knownPool,
  );
  const [report, rewardRate, poolTvlMusd] = await Promise.all([
    buildClRangeDepthReport({ client, pairLabel: pair.label, pool, managerAddress: manager }),
    readLiveGaugeRewardRate(client, pool.gauge, latestBlock.timestamp),
    readPoolTvlMusd({ client, pool, prices }),
  ]);
  return {
    ...report,
    activeLiquidityApr: activeLiquidityAprPercent({
      rewardRate,
      mezoPriceMusd: lookupPriceMusd(prices, TRACKED_TOKENS[1].address, "MEZO"),
      poolTvlMusd,
      activeLiquidity: pool.liquidity,
      stakedLiquidity: pool.stakedLiquidity,
    }),
  };
}
