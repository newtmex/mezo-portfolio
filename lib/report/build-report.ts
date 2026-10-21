import { formatUnits, getAddress, type Address, type PublicClient } from "viem";

import { clTicksAbi, erc20Abi, gaugeAbi } from "../abis";
import { getHttpClient } from "../clients";
import { ADDRESSES, getManagerAddress, MEZO_CHAIN_ID, PAIRS, TRACKED_TOKENS } from "../config";
import {
  buildClRangeDepthReport,
  collectManagerPoolPositions,
  readManagerTokenHoldings,
} from "./manager-liquidity";
import { activeLiquidityAprPercent, annualEmissionValueMusd } from "./apr";
import { fetchMezoPriceMapMusd, lookupPriceMusd } from "./mezo-prices";
import { resolveMostLiquidClPool } from "./pools";
import { amountsForLiquidity } from "../math/amounts";
import { sqrtRatioAtTick } from "../math/tick-math";
import type { ClRangeDepthReport, ManagerRangeDepthPayload } from "./types";

async function readInRangeLiquidityValueMusd(input: {
  client: PublicClient;
  pool: {
    address: Address;
    token0: Address;
    token1: Address;
    tick: number;
    tickSpacing: number;
    sqrtPriceX96: bigint;
    liquidity: bigint;
  };
  prices: ReadonlyMap<string, number>;
}): Promise<number | null> {
  const [decimals0, decimals1] = await Promise.all([
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
  const minTick = Math.ceil(-887272 / input.pool.tickSpacing) * input.pool.tickSpacing;
  const maxTick = Math.floor(887272 / input.pool.tickSpacing) * input.pool.tickSpacing;
  const compressedCurrent = Math.floor(input.pool.tick / input.pool.tickSpacing);
  const minWord = Math.floor(Math.floor(minTick / input.pool.tickSpacing) / 256);
  const maxWord = Math.floor(Math.floor(maxTick / input.pool.tickSpacing) / 256);
  const wordPositions = Array.from({ length: maxWord - minWord + 1 }, (_, i) => minWord + i);
  const bitmaps = await input.client.multicall({
    allowFailure: false,
    contracts: wordPositions.map((word) => ({
      address: input.pool.address,
      abi: clTicksAbi,
      functionName: "tickBitmap" as const,
      args: [word] as const,
    })),
  });
  const initializedTicks: number[] = [];
  for (const [wordIndex, bitmapValue] of bitmaps.entries()) {
    let bitmap = BigInt(bitmapValue);
    while (bitmap !== 0n) {
      const leastBit = bitmap & -bitmap;
      const bit = leastBit.toString(2).length - 1;
      const compressed = (wordPositions[wordIndex] * 256 + bit) * input.pool.tickSpacing;
      if (compressed >= minTick && compressed <= maxTick) initializedTicks.push(compressed);
      bitmap ^= leastBit;
    }
  }
  const ticks = await input.client.multicall({
    allowFailure: true,
    contracts: initializedTicks.map((tick) => ({
      address: input.pool.address,
      abi: clTicksAbi,
      functionName: "ticks" as const,
      args: [tick] as const,
    })),
  });
  let activeLiquidity = 0n;
  for (const [index, result] of ticks.entries()) {
    if (result.status !== "success" || !result.result[7]) continue;
    if (initializedTicks[index] <= input.pool.tick) activeLiquidity += BigInt(result.result[1]);
  }
  if (activeLiquidity !== input.pool.liquidity) {
    console.warn("[admin-report] Tick liquidity sum differs from pool active liquidity", {
      pool: input.pool.address,
      tick: input.pool.tick,
      currentCompressedTick: compressedCurrent,
      summed: activeLiquidity.toString(),
      poolLiquidity: input.pool.liquidity.toString(),
    });
    activeLiquidity = input.pool.liquidity;
  }
  if (activeLiquidity <= 0n) return null;
  const amounts = amountsForLiquidity(
    input.pool.sqrtPriceX96,
    -887272,
    887272,
    activeLiquidity,
  );
  const value0 = Number(formatUnits(amounts.amount0, decimals0)) * price0;
  const value1 = Number(formatUnits(amounts.amount1, decimals1)) * price1;
  const total = value0 + value1;
  return Number.isFinite(total) && total > 0 ? total : null;
}

async function readLiveGaugeRewardRate(
  client: PublicClient,
  gauge: Address,
  timestamp: bigint,
): Promise<bigint> {
  const [rewardRate, periodFinish] = await Promise.all([
    client.readContract({ address: gauge, abi: gaugeAbi, functionName: "rewardRate" }),
    client.readContract({ address: gauge, abi: gaugeAbi, functionName: "periodFinish" }),
  ]);
  if (periodFinish <= timestamp) return 0n;
  return rewardRate;
}

async function readLiveGaugeAnnualEmissionValue(
  client: PublicClient,
  gauge: Address,
  timestamp: bigint,
  prices: ReadonlyMap<string, number>,
): Promise<number | null> {
  const [rewardRate, periodFinish, rewardToken] = await Promise.all([
    client.readContract({ address: gauge, abi: gaugeAbi, functionName: "rewardRate" }),
    client.readContract({ address: gauge, abi: gaugeAbi, functionName: "periodFinish" }),
    client.readContract({ address: gauge, abi: gaugeAbi, functionName: "rewardToken" }),
  ]);
  if (periodFinish <= timestamp) return 0;
  const token = getAddress(rewardToken);
  const [decimals, symbol] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
  ]);
  if (token !== ADDRESSES.mezo && symbol.toUpperCase() !== "AERO") return 0;
  const price = lookupPriceMusd(prices, token, symbol);
  return annualEmissionValueMusd({
    rewardRate,
    rewardDecimals: Number(decimals),
    rewardPriceMusd: price,
  });
}

export async function buildManagerRangeDepthReport(input?: {
  client?: PublicClient;
  manager?: Address;
}): Promise<ManagerRangeDepthPayload> {
  const client = input?.client ?? getHttpClient();
  const manager = input?.manager ?? getManagerAddress();
  let hasPartialErrors = false;
  const prices = await fetchMezoPriceMapMusd().catch((error) => {
    hasPartialErrors = true;
    console.error("[admin-report] Failed to fetch token prices", { error });
    return new Map<string, number>();
  });

  const snapshotResults = await Promise.allSettled(
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
  const pairSnapshots = snapshotResults.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    hasPartialErrors = true;
    console.error("[admin-report] Failed to resolve pool snapshot", {
      pair: PAIRS[index].label,
      error: result.reason,
    });
    return [];
  });

  const latestBlock = await client.getBlock().catch((error) => {
    hasPartialErrors = true;
    console.error("[admin-report] Failed to read latest block for emissions", { error });
    return null;
  });
  const gaugePools = pairSnapshots.map(({ pool }) => pool).filter((pool) => pool.gauge);
  const aggregateEmissionRates = await Promise.all(
    gaugePools.map((pool) =>
      latestBlock
        ? readLiveGaugeRewardRate(client, pool.gauge, latestBlock.timestamp).catch((error) => {
            hasPartialErrors = true;
            console.error("[admin-report] Failed to read gauge reward rate", {
              gauge: pool.gauge,
              error,
            });
            return 0n;
          })
        : Promise.resolve(0n),
    ),
  );
  const annualEmissionValues = await Promise.all(
    gaugePools.map((pool) =>
      latestBlock
        ? readLiveGaugeAnnualEmissionValue(client, pool.gauge, latestBlock.timestamp, prices).catch(
            (error) => {
              hasPartialErrors = true;
              console.error("[admin-report] Failed to read annual gauge emissions", {
                gauge: pool.gauge,
                error,
              });
              return null;
            },
          )
        : Promise.resolve(null),
    ),
  );

  const mezoPrice = lookupPriceMusd(prices, TRACKED_TOKENS[1].address, "MEZO");

  const reportResults = await Promise.allSettled(
    pairSnapshots.map(async ({ pair, pool }) => {
      const report = await buildClRangeDepthReport({
        client,
        pairLabel: pair.label,
        pool,
        managerAddress: manager,
      });
      let inRangeLiquidityValueMusd: number | null = null;
      try {
        inRangeLiquidityValueMusd = await readInRangeLiquidityValueMusd({
          client,
          pool: {
            address: pool.address,
            token0: pool.token0,
            token1: pool.token1,
            tick: pool.tick,
            tickSpacing: pool.tickSpacing,
            sqrtPriceX96: pool.sqrtPriceX96,
            liquidity: pool.liquidity,
          },
          prices,
        });
      } catch (error) {
        hasPartialErrors = true;
        console.error("[admin-report] Failed to read in-range liquidity value", {
          pair: pair.label,
          pool: pool.address,
          error,
        });
      }
      const gaugeIndex = gaugePools.findIndex(
        (candidate) => candidate.gauge.toLowerCase() === pool.gauge.toLowerCase(),
      );
      const annualRewardValueMusd = annualEmissionValues[gaugeIndex];
      return {
        ...report,
        activeLiquidityApr: activeLiquidityAprPercent({
          annualRewardValueMusd: annualRewardValueMusd ?? Number.NaN,
          inRangeLiquidityValueMusd,
        }),
        hasPartialErrors: report.hasPartialErrors,
      };
    }),
  );
  const reports = reportResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.hasPartialErrors) hasPartialErrors = true;
      return [result.value];
    }
    hasPartialErrors = true;
    console.error("[admin-report] Failed to build pool range-depth report", {
      pair: pairSnapshots[index].pair.label,
      pool: pairSnapshots[index].pool.address,
      error: result.reason,
    });
    return [];
  });

  const calculatedMezoPerDay = gaugePools.reduce((total, pool, index) => {
    const report = reports.find((candidate) => candidate.gauge === pool.gauge);
    const activeShareBps = report?.managerStakedActiveLiquidityShareBps;
    if (activeShareBps == null) return total;
    const accountRate = (aggregateEmissionRates[index] * BigInt(activeShareBps)) / 10_000n;
    return total + Number(formatUnits(accountRate, 18)) * 86_400;
  }, 0);
  const mezoPerDay = latestBlock ? calculatedMezoPerDay : null;
  const tokenHoldingsPromise = readManagerTokenHoldings({
    client,
    manager,
    tokens: TRACKED_TOKENS.map((token) => ({
      symbol: token.symbol,
      address: token.address,
    })),
    prices,
  });
  const positionSnapshots = pairSnapshots.filter(({ pair }) =>
    reports.some((report) => report.pairLabel === pair.label),
  );
  const [tokenHoldingsSettled, positionResults] = await Promise.all([
    Promise.allSettled([tokenHoldingsPromise]),
    Promise.allSettled(
      positionSnapshots.map(async ({ pair, pool }) => {
        const report = reports.find((candidate) => candidate.pairLabel === pair.label)!;
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
    ),
  ]);
  const tokenHoldingsResult = tokenHoldingsSettled[0];

  const tokenHoldings = tokenHoldingsResult.status === "fulfilled"
    ? tokenHoldingsResult.value.holdings
    : [];
  if (tokenHoldingsResult.status === "fulfilled" && tokenHoldingsResult.value.hasErrors) {
    hasPartialErrors = true;
  }
  if (tokenHoldingsResult.status === "rejected") {
    hasPartialErrors = true;
    console.error("[admin-report] Failed to read manager token holdings", {
      manager,
      error: tokenHoldingsResult.reason,
    });
  }
  const clPositions = positionResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.hasErrors) hasPartialErrors = true;
      return result.value.positions;
    }
    hasPartialErrors = true;
    console.error("[admin-report] Failed to read manager positions for pool", {
      pair: positionSnapshots[index].pair.label,
      pool: positionSnapshots[index].pool.address,
      manager,
      error: result.reason,
    });
    return [];
  });

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
      mezoPerDay: mezoPerDay != null && Number.isFinite(mezoPerDay) ? mezoPerDay : null,
      valueMusdPerDay:
        mezoPrice != null && mezoPerDay != null && Number.isFinite(mezoPerDay)
          ? mezoPerDay * mezoPrice
          : null,
    },
    hasPartialErrors,
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
  let hasPartialErrors = false;
  const [prices, latestBlock] = await Promise.all([
    fetchMezoPriceMapMusd().catch((error) => {
      hasPartialErrors = true;
      console.error("[admin-report] Failed to fetch token prices", { error });
      return new Map<string, number>();
    }),
    client.getBlock().catch((error) => {
      hasPartialErrors = true;
      console.error("[admin-report] Failed to read latest block for emissions", { error });
      return null;
    }),
  ]);
  const pool = await resolveMostLiquidClPool(
    client,
    pair.tokenA,
    pair.tokenB,
    pair.label,
    pair.knownPool,
  );
  const [report, annualRewardValueMusd, inRangeLiquidityValueMusd] = await Promise.all([
    buildClRangeDepthReport({ client, pairLabel: pair.label, pool, managerAddress: manager }),
    latestBlock
      ? readLiveGaugeAnnualEmissionValue(client, pool.gauge, latestBlock.timestamp, prices).catch(
          (error) => {
            hasPartialErrors = true;
            console.error("[admin-report] Failed to read annual gauge emissions", {
              gauge: pool.gauge,
              error,
            });
            return null;
          },
        )
      : Promise.resolve(null),
    readInRangeLiquidityValueMusd({
      client,
      pool: {
        address: pool.address,
        token0: pool.token0,
        token1: pool.token1,
        tick: pool.tick,
        tickSpacing: pool.tickSpacing,
        sqrtPriceX96: pool.sqrtPriceX96,
        liquidity: pool.liquidity,
      },
      prices,
    }).catch((error) => {
      hasPartialErrors = true;
      console.error("[admin-report] Failed to read in-range liquidity value", {
        pair: pair.label,
        pool: pool.address,
        error,
      });
      return null;
    }),
  ]);
  return {
    ...report,
    hasPartialErrors: report.hasPartialErrors || hasPartialErrors,
    activeLiquidityApr: activeLiquidityAprPercent({
      annualRewardValueMusd: annualRewardValueMusd ?? Number.NaN,
      inRangeLiquidityValueMusd,
    }),
  };
}
