import { formatUnits, getAddress, type Address, type PublicClient } from "viem";

import { erc20Abi, gaugeAbi, npmAbi } from "../abis";
import { ADDRESSES } from "../config";
import { amountsForLiquidity } from "../math/amounts";
import {
  amount0InToReachSqrt,
  amount1InToReachSqrt,
  depthDiffRatioBps,
  formatBpsPercent,
  managerActiveShareBps,
} from "../math/depth";
import { sqrtRatioAtTick, tightestRange } from "../math/tick-math";
import { lookupPriceMusd, valueRawAmountMusd } from "./mezo-prices";
import type { ClPoolSnapshot } from "./pools";
import type {
  ClRangeDepthReport,
  DepthSide,
  ManagerClPositionValue,
  ManagerTokenHolding,
} from "./types";

const Q96 = 1n << 96n;

function positionInRange(tick: number, tickLower: number, tickUpper: number): boolean {
  return tick >= tickLower && tick < tickUpper;
}

function priceToken1PerToken0(sqrtPriceX96: bigint): number {
  const ratio = Number(sqrtPriceX96) / Number(Q96);
  return ratio * ratio;
}

function formatDepth(amount: bigint, symbol: string, decimals: number): DepthSide {
  return {
    token: symbol,
    symbol,
    amount: amount.toString(),
    formatted: `${formatUnits(amount, decimals)} ${symbol}`,
  };
}

export async function collectManagerRangeLiquidity(input: {
  client: PublicClient;
  gauge: Address;
  manager: Address;
  token0: Address;
  token1: Address;
  tickSpacing: number;
  tick: number;
}): Promise<{
  liquidity: bigint;
  stakedLiquidity: bigint;
  tokenIds: bigint[];
  stakedIds: bigint[];
}> {
  const tokenIds: bigint[] = [];
  const stakedIds: bigint[] = [];

  const consider = async (tokenId: bigint, staked: boolean): Promise<bigint> => {
    const position = await input.client.readContract({
      address: ADDRESSES.npm,
      abi: npmAbi,
      functionName: "positions",
      args: [tokenId],
    });
    if (getAddress(position[2]) !== input.token0) return 0n;
    if (getAddress(position[3]) !== input.token1) return 0n;
    if (Number(position[4]) !== input.tickSpacing) return 0n;
    const tickLower = Number(position[5]);
    const tickUpper = Number(position[6]);
    if (!positionInRange(input.tick, tickLower, tickUpper)) return 0n;
    const liquidity = BigInt(position[7]);
    if (liquidity === 0n) return 0n;
    tokenIds.push(tokenId);
    if (staked) stakedIds.push(tokenId);
    return liquidity;
  };

  let liquidity = 0n;
  let stakedLiquidity = 0n;
  const walletCount = await input.client.readContract({
    address: ADDRESSES.npm,
    abi: npmAbi,
    functionName: "balanceOf",
    args: [input.manager],
  });
  if (walletCount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Manager NFT count ${walletCount.toString()} exceeds the safe limit.`);
  }
  for (let index = 0; index < Number(walletCount); index += 1) {
    const tokenId = await input.client.readContract({
      address: ADDRESSES.npm,
      abi: npmAbi,
      functionName: "tokenOfOwnerByIndex",
      args: [input.manager, BigInt(index)],
    });
    liquidity += await consider(tokenId, false);
  }

  const staked = await input.client.readContract({
    address: input.gauge,
    abi: gaugeAbi,
    functionName: "stakedValues",
    args: [input.manager],
  });
  for (const tokenId of staked) {
    const amount = await consider(tokenId, true);
    liquidity += amount;
    stakedLiquidity += amount;
  }

  return { liquidity, stakedLiquidity, tokenIds, stakedIds };
}

export async function buildClRangeDepthReport(input: {
  client: PublicClient;
  pairLabel: string;
  pool: ClPoolSnapshot;
  managerAddress: Address | null;
}): Promise<ClRangeDepthReport> {
  const range = tightestRange(input.pool.tick, input.pool.tickSpacing);
  const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
    input.client.readContract({
      address: input.pool.token0,
      abi: erc20Abi,
      functionName: "symbol",
    }),
    input.client.readContract({
      address: input.pool.token1,
      abi: erc20Abi,
      functionName: "symbol",
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

  let managerLiquidity = 0n;
  let managerStakedLiquidity = 0n;
  let managerTokenIds: bigint[] = [];
  let managerStakedIds: bigint[] = [];
  if (input.managerAddress) {
    const found = await collectManagerRangeLiquidity({
      client: input.client,
      gauge: input.pool.gauge,
      manager: input.managerAddress,
      token0: input.pool.token0,
      token1: input.pool.token1,
      tickSpacing: input.pool.tickSpacing,
      tick: input.pool.tick,
    });
    managerLiquidity = found.liquidity;
    managerStakedLiquidity = found.stakedLiquidity;
    managerTokenIds = found.tokenIds;
    managerStakedIds = found.stakedIds;
  }

  const sqrtLower = sqrtRatioAtTick(range.tickLower);
  const sqrtUpper = sqrtRatioAtTick(range.tickUpper);
  const liquidityWithout =
    input.pool.liquidity > managerLiquidity ? input.pool.liquidity - managerLiquidity : 0n;

  const scenario = (label: string, liquidity: bigint) => ({
    label,
    liquidity,
    toLower: formatDepth(
      amount0InToReachSqrt(input.pool.sqrtPriceX96, sqrtLower, liquidity, input.pool.fee),
      symbol0,
      Number(decimals0),
    ),
    toUpper: formatDepth(
      amount1InToReachSqrt(input.pool.sqrtPriceX96, sqrtUpper, liquidity, input.pool.fee),
      symbol1,
      Number(decimals1),
    ),
  });

  const withManager = scenario("with manager liquidity", input.pool.liquidity);
  const withoutManager = scenario("without manager liquidity", liquidityWithout);
  const managerShareBps = managerActiveShareBps(managerLiquidity, input.pool.liquidity);
  const managerStakedShareBps = managerActiveShareBps(managerStakedLiquidity, input.pool.liquidity);
  const depthDiffToken0Bps = depthDiffRatioBps(
    BigInt(withManager.toLower.amount),
    BigInt(withoutManager.toLower.amount),
  );
  const depthDiffToken1Bps = depthDiffRatioBps(
    BigInt(withManager.toUpper.amount),
    BigInt(withoutManager.toUpper.amount),
  );

  return {
    pairLabel: input.pairLabel,
    pool: input.pool.address,
    gauge: input.pool.gauge,
    tickSpacing: input.pool.tickSpacing,
    fee: input.pool.fee.toString(),
    activeLiquidityApr: null,
    tick: input.pool.tick,
    range,
    sqrtPriceX96: input.pool.sqrtPriceX96.toString(),
    priceToken1PerToken0: priceToken1PerToken0(input.pool.sqrtPriceX96),
    token0: { address: input.pool.token0, symbol: symbol0 },
    token1: { address: input.pool.token1, symbol: symbol1 },
    manager: input.managerAddress,
    managerInRangeLiquidity: managerLiquidity.toString(),
    managerStakedInRangeLiquidity: managerStakedLiquidity.toString(),
    managerTokenIds: managerTokenIds.map((id) => id.toString()),
    managerStakedTokenIds: managerStakedIds.map((id) => id.toString()),
    activeLiquidity: input.pool.liquidity.toString(),
    activeLiquidityWithoutManager: liquidityWithout.toString(),
    managerActiveLiquidityShareBps: managerShareBps?.toString() ?? null,
    managerStakedActiveLiquidityShareBps: managerStakedShareBps?.toString() ?? null,
    managerActiveLiquidityShare: formatBpsPercent(managerShareBps),
    priceMoveDepthDiffBps: {
      sellToken0ToLeaveLower: depthDiffToken0Bps?.toString() ?? null,
      sellToken1ToLeaveUpper: depthDiffToken1Bps?.toString() ?? null,
    },
    priceMoveDepthDiff: {
      sellToken0ToLeaveLower: formatBpsPercent(depthDiffToken0Bps),
      sellToken1ToLeaveUpper: formatBpsPercent(depthDiffToken1Bps),
    },
    scenarios: [withManager, withoutManager].map((row) => ({
      label: row.label,
      liquidity: row.liquidity.toString(),
      sellToken0ToLeaveLower: row.toLower,
      sellToken1ToLeaveUpper: row.toUpper,
    })),
  };
}

export async function readManagerTokenHoldings(input: {
  client: PublicClient;
  manager: Address;
  tokens: ReadonlyArray<{ symbol: string; address: Address }>;
  prices: ReadonlyMap<string, number>;
}): Promise<ManagerTokenHolding[]> {
  return Promise.all(
    input.tokens.map(async (token) => {
      const [raw, decimals] = await Promise.all([
        input.client.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [input.manager],
        }),
        input.client.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]);
      const decimalsNumber = Number(decimals);
      const priceMusd = lookupPriceMusd(input.prices, token.address, token.symbol);
      return {
        symbol: token.symbol,
        address: token.address,
        amountRaw: raw.toString(),
        amount: formatUnits(raw, decimalsNumber),
        priceMusd,
        valueMusd: valueRawAmountMusd(raw, decimalsNumber, priceMusd),
      } satisfies ManagerTokenHolding;
    }),
  );
}

export async function collectManagerPoolPositions(input: {
  client: PublicClient;
  pool: ClPoolSnapshot;
  pairLabel: string;
  manager: Address;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  prices: ReadonlyMap<string, number>;
}): Promise<ManagerClPositionValue[]> {
  const price0 = lookupPriceMusd(input.prices, input.pool.token0, input.symbol0);
  const price1 = lookupPriceMusd(input.prices, input.pool.token1, input.symbol1);

  const staked = await input.client.readContract({
    address: input.pool.gauge,
    abi: gaugeAbi,
    functionName: "stakedValues",
    args: [input.manager],
  });
  const stakedIds = new Set(staked.map((id) => id.toString()));
  const candidateIds = new Set<string>(stakedIds);

  const walletCount = await input.client.readContract({
    address: ADDRESSES.npm,
    abi: npmAbi,
    functionName: "balanceOf",
    args: [input.manager],
  });
  if (walletCount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Manager NFT count ${walletCount.toString()} exceeds the safe limit.`);
  }
  for (let index = 0; index < Number(walletCount); index += 1) {
    const tokenId = await input.client.readContract({
      address: ADDRESSES.npm,
      abi: npmAbi,
      functionName: "tokenOfOwnerByIndex",
      args: [input.manager, BigInt(index)],
    });
    candidateIds.add(tokenId.toString());
  }

  const positions: ManagerClPositionValue[] = [];
  for (const idText of candidateIds) {
    const tokenId = BigInt(idText);
    const position = await input.client.readContract({
      address: ADDRESSES.npm,
      abi: npmAbi,
      functionName: "positions",
      args: [tokenId],
    });
    if (getAddress(position[2]) !== input.pool.token0) continue;
    if (getAddress(position[3]) !== input.pool.token1) continue;
    if (Number(position[4]) !== input.pool.tickSpacing) continue;
    const liquidity = BigInt(position[7]);
    if (liquidity === 0n) continue;

    const tickLower = Number(position[5]);
    const tickUpper = Number(position[6]);
    const amounts = amountsForLiquidity(input.pool.sqrtPriceX96, tickLower, tickUpper, liquidity);
    const value0 = valueRawAmountMusd(amounts.amount0, input.decimals0, price0);
    const value1 = valueRawAmountMusd(amounts.amount1, input.decimals1, price1);
    const valueMusd = value0 == null && value1 == null ? null : (value0 ?? 0) + (value1 ?? 0);

    positions.push({
      pair: input.pairLabel,
      tokenId: idText,
      staked: stakedIds.has(idText),
      tickLower,
      tickUpper,
      inRange: input.pool.tick >= tickLower && input.pool.tick < tickUpper,
      amount0: formatUnits(amounts.amount0, input.decimals0),
      amount1: formatUnits(amounts.amount1, input.decimals1),
      symbol0: input.symbol0,
      symbol1: input.symbol1,
      valueMusd,
    });
  }

  return positions.sort((left, right) => Number(BigInt(left.tokenId) - BigInt(right.tokenId)));
}
