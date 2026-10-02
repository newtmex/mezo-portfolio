import { formatUnits, getAddress, type Address, type PublicClient } from "viem";

import { baseGaugeAbi, baseVoterAbi, clFactoryAbi, clPoolAbi, erc20Abi, npmAbi } from "../abis";
import { BASE_ADDRESSES, getManagerAddressOrNull } from "../config";
import { getBaseHttpClient } from "../clients";
import { tightestRange } from "../math/tick-math";
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
  managerStakedTokenIds: string[];
  balances: Array<{ symbol: string; amount: string }>;
};

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
  let managerStakedTokenIds: string[] = [];
  let managerStakedLiquidity = 0n;
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
          managerStakedLiquidity += BigInt(position[7]);
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
  const tick = Number(slot0[1]);

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
    range: tightestRange(tick, Number(tickSpacing)),
    activeLiquidity: BigInt(liquidity).toString(),
    managerStakedLiquidity: managerStakedLiquidity.toString(),
    managerStakedTokenIds,
    balances: [
      { symbol: metadata0.symbol, amount: formatUnits(metadata0.balance, metadata0.decimals) },
      { symbol: metadata1.symbol, amount: formatUnits(metadata1.balance, metadata1.decimals) },
    ],
  };
}
