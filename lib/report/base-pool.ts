import { formatUnits, getAddress, type Address, type PublicClient } from "viem";

import { baseGaugeAbi, baseVoterAbi, clFactoryAbi, clPoolAbi, erc20Abi, npmAbi } from "../abis";
import { BASE_ADDRESSES, getManagerAddressOrNull } from "../config";
import { getBaseHttpClient } from "../clients";
import {
  amount0InToReachSqrt,
  amount1InToReachSqrt,
  managerActiveShareBps,
} from "../math/depth";
import { sqrtRatioAtTick, tightestRange } from "../math/tick-math";
import { zeroAddress } from "viem";

const BASE_TICK_SPACING = 200;

export type BasePoolReport = {
  chainId: 8453;
  pairLabel: "MUSD/MEZO";
  pool: Address;
  factory: Address;
  gauge: Address | null;
  manager: Address | null;
  token0: { address: Address; symbol: string; decimals: number };
  token1: { address: Address; symbol: string; decimals: number };
  tickSpacing: number;
  fee: string;
  tick: number;
  range: { tickLower: number; tickUpper: number };
  activeLiquidity: string;
  managerStakedLiquidity: string;
  managerStakedActiveLiquidity: string;
  managerStakedActiveLiquidityShareBps: string | null;
  aeroPerDay: number | null;
  aeroValueUsdPerDay: number | null;
  managerStakedTokenIds: string[];
  priceMoveDepth: {
    withPortfolio: { token0ToLower: string; token1ToUpper: string };
    withoutPortfolio: { token0ToLower: string; token1ToUpper: string };
  };
  balances: Array<{ symbol: string; amount: string }>;
};

function priceMoveAmounts(input: {
  liquidity: bigint;
  sqrtPriceX96: bigint;
  sqrtLower: bigint;
  sqrtUpper: bigint;
  fee: bigint;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
}) {
  return {
    token0ToLower: `${formatUnits(
      amount0InToReachSqrt(input.sqrtPriceX96, input.sqrtLower, input.liquidity, input.fee),
      input.decimals0,
    )} ${input.symbol0}`,
    token1ToUpper: `${formatUnits(
      amount1InToReachSqrt(input.sqrtPriceX96, input.sqrtUpper, input.liquidity, input.fee),
      input.decimals1,
    )} ${input.symbol1}`,
  };
}

export async function buildBasePoolReport(input?: {
  client?: PublicClient;
}): Promise<BasePoolReport> {
  const client = input?.client ?? getBaseHttpClient();
  const [
    factoryPool,
    token0,
    token1,
    fee,
    tickSpacing,
    slot0,
    liquidity,
    symbol0,
    decimals0,
    balance0,
    symbol1,
    decimals1,
    balance1,
    gaugeResult,
  ] = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: BASE_ADDRESSES.clFactory,
        abi: clFactoryAbi,
        functionName: "getPool",
        args: [BASE_ADDRESSES.mezo, BASE_ADDRESSES.musd, BASE_TICK_SPACING],
      },
      { address: BASE_ADDRESSES.pool, abi: clPoolAbi, functionName: "token0" },
      { address: BASE_ADDRESSES.pool, abi: clPoolAbi, functionName: "token1" },
      { address: BASE_ADDRESSES.pool, abi: clPoolAbi, functionName: "fee" },
      { address: BASE_ADDRESSES.pool, abi: clPoolAbi, functionName: "tickSpacing" },
      { address: BASE_ADDRESSES.pool, abi: clPoolAbi, functionName: "slot0" },
      { address: BASE_ADDRESSES.pool, abi: clPoolAbi, functionName: "liquidity" },
      { address: BASE_ADDRESSES.mezo, abi: erc20Abi, functionName: "symbol" },
      { address: BASE_ADDRESSES.mezo, abi: erc20Abi, functionName: "decimals" },
      {
        address: BASE_ADDRESSES.mezo,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [BASE_ADDRESSES.pool],
      },
      { address: BASE_ADDRESSES.musd, abi: erc20Abi, functionName: "symbol" },
      { address: BASE_ADDRESSES.musd, abi: erc20Abi, functionName: "decimals" },
      {
        address: BASE_ADDRESSES.musd,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [BASE_ADDRESSES.pool],
      },
      {
        address: BASE_ADDRESSES.voter,
        abi: baseVoterAbi,
        functionName: "gauges",
        args: [BASE_ADDRESSES.pool],
      },
    ],
  });
  const resolvedPool = getAddress(factoryPool);
  if (resolvedPool !== BASE_ADDRESSES.pool) {
    throw new Error(`Unexpected Base MUSD/MEZO pool: ${resolvedPool}`);
  }
  const normalizedToken0 = getAddress(token0);
  const normalizedToken1 = getAddress(token1);
  if (normalizedToken0 !== BASE_ADDRESSES.mezo || normalizedToken1 !== BASE_ADDRESSES.musd) {
    throw new Error("Base MUSD/MEZO pool token order does not match the configured pair.");
  }
  if (Number(tickSpacing) !== BASE_TICK_SPACING) {
    throw new Error(`Expected Base tick spacing ${BASE_TICK_SPACING}, got ${tickSpacing}.`);
  }
  if (BigInt(slot0[0]) === 0n) {
    throw new Error("Base MUSD/MEZO pool is not initialized.");
  }

  const gauge = getAddress(gaugeResult);
  const manager = getManagerAddressOrNull();
  const tick = Number(slot0[1]);
  let managerStakedTokenIds: string[] = [];
  let managerStakedLiquidity = 0n;
  let managerStakedActiveLiquidity = 0n;
  if (manager && gauge !== zeroAddress) {
    const [stakedLength] = await client.multicall({
      allowFailure: false,
      contracts: [
        {
          address: gauge,
          abi: baseGaugeAbi,
          functionName: "stakedLength",
          args: [manager],
        },
      ],
    });
    const length = Number(stakedLength);
    if (length > 0) {
      const stakedIds = await client.multicall({
        allowFailure: false,
        contracts: Array.from({ length }, (_, index) => ({
          address: gauge,
          abi: baseGaugeAbi,
          functionName: "stakedByIndex" as const,
          args: [manager, BigInt(index)] as const,
        })),
      });
      const positions = await client.multicall({
        allowFailure: false,
        contracts: stakedIds.map((tokenId) => ({
          address: BASE_ADDRESSES.npm,
          abi: npmAbi,
          functionName: "positions" as const,
          args: [BigInt(tokenId)] as const,
        })),
      });
      managerStakedTokenIds = stakedIds.map((tokenId) => BigInt(tokenId).toString());
      for (const position of positions) {
        if (
          getAddress(position[2]) === BASE_ADDRESSES.mezo &&
          getAddress(position[3]) === BASE_ADDRESSES.musd &&
          Number(position[4]) === BASE_TICK_SPACING
        ) {
          const positionLiquidity = BigInt(position[7]);
          managerStakedLiquidity += positionLiquidity;
          if (tick >= Number(position[5]) && tick < Number(position[6])) {
            managerStakedActiveLiquidity += positionLiquidity;
          }
        }
      }
    }
  }

  const metadata0 = {
    address: normalizedToken0,
    symbol: symbol0,
    decimals: Number(decimals0),
    balance: BigInt(balance0),
  };
  const metadata1 = {
    address: normalizedToken1,
    symbol: symbol1,
    decimals: Number(decimals1),
    balance: BigInt(balance1),
  };
  const poolLiquidity = BigInt(liquidity);
  const feeRaw = BigInt(fee);
  const range = tightestRange(tick, Number(tickSpacing));
  const sqrtPriceX96 = BigInt(slot0[0]);
  const sqrtLower = sqrtRatioAtTick(range.tickLower);
  const sqrtUpper = sqrtRatioAtTick(range.tickUpper);
  const liquidityWithoutPortfolio =
    poolLiquidity > managerStakedActiveLiquidity
      ? poolLiquidity - managerStakedActiveLiquidity
      : 0n;
  let aeroPerDay: number | null = null;
  let aeroValueUsdPerDay: number | null = null;
  if (gauge !== zeroAddress && manager && poolLiquidity > 0n) {
    try {
      const [rewardRate, periodFinish, rewardToken] = await client.multicall({
        allowFailure: false,
        contracts: [
          { address: gauge, abi: baseGaugeAbi, functionName: "rewardRate" },
          { address: gauge, abi: baseGaugeAbi, functionName: "periodFinish" },
          { address: gauge, abi: baseGaugeAbi, functionName: "rewardToken" },
        ],
      });
      const [rewardDecimals, rewardSymbol] = await client.multicall({
        allowFailure: false,
        contracts: [
          { address: getAddress(rewardToken), abi: erc20Abi, functionName: "decimals" },
          { address: getAddress(rewardToken), abi: erc20Abi, functionName: "symbol" },
        ],
      });
      if (rewardSymbol.toUpperCase() === "AERO" && BigInt(periodFinish) > BigInt(Math.floor(Date.now() / 1000))) {
        const managerShare = Number(managerStakedActiveLiquidity) / Number(poolLiquidity);
        aeroPerDay = Number(formatUnits(BigInt(rewardRate), Number(rewardDecimals))) * 86_400 * managerShare;
        try {
          const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=aerodrome-finance&vs_currencies=usd", {
            next: { revalidate: 300 },
          });
          if (response.ok) {
            const body = (await response.json()) as { "aerodrome-finance"?: { usd?: number } };
            const price = body["aerodrome-finance"]?.usd;
            if (typeof price === "number" && Number.isFinite(price)) aeroValueUsdPerDay = aeroPerDay * price;
          }
        } catch {
          // Keep the on-chain token amount available when the spot price API is unavailable.
        }
      }
    } catch {
      // Reward-rate methods are not implemented by every Aerodrome gauge.
    }
  }
  return {
    chainId: 8453,
    pairLabel: "MUSD/MEZO",
    pool: resolvedPool,
    factory: BASE_ADDRESSES.clFactory,
    gauge: gauge === zeroAddress ? null : gauge,
    manager,
    token0: {
      address: metadata0.address,
      symbol: metadata0.symbol,
      decimals: metadata0.decimals,
    },
    token1: {
      address: metadata1.address,
      symbol: metadata1.symbol,
      decimals: metadata1.decimals,
    },
    tickSpacing: Number(tickSpacing),
    fee: BigInt(fee).toString(),
    tick,
    range,
    activeLiquidity: poolLiquidity.toString(),
    managerStakedLiquidity: managerStakedLiquidity.toString(),
    managerStakedActiveLiquidity: managerStakedActiveLiquidity.toString(),
    managerStakedActiveLiquidityShareBps: managerActiveShareBps(
      managerStakedActiveLiquidity,
      poolLiquidity,
    )?.toString() ?? null,
    aeroPerDay,
    aeroValueUsdPerDay,
    managerStakedTokenIds,
    priceMoveDepth: {
      withPortfolio: priceMoveAmounts({
        liquidity: poolLiquidity,
        sqrtPriceX96,
        sqrtLower,
        sqrtUpper,
        fee: feeRaw,
        symbol0: metadata0.symbol,
        symbol1: metadata1.symbol,
        decimals0: metadata0.decimals,
        decimals1: metadata1.decimals,
      }),
      withoutPortfolio: priceMoveAmounts({
        liquidity: liquidityWithoutPortfolio,
        sqrtPriceX96,
        sqrtLower,
        sqrtUpper,
        fee: feeRaw,
        symbol0: metadata0.symbol,
        symbol1: metadata1.symbol,
        decimals0: metadata0.decimals,
        decimals1: metadata1.decimals,
      }),
    },
    balances: [
      { symbol: metadata0.symbol, amount: formatUnits(metadata0.balance, metadata0.decimals) },
      { symbol: metadata1.symbol, amount: formatUnits(metadata1.balance, metadata1.decimals) },
    ],
  };
}
