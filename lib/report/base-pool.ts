import { formatUnits, getAddress, type Address, type PublicClient } from "viem";

import { clFactoryAbi, clPoolAbi, erc20Abi } from "../abis";
import { BASE_ADDRESSES } from "../config";
import { getBaseHttpClient } from "../clients";
import { tightestRange } from "../math/tick-math";

const BASE_TICK_SPACING = 200;

export type BasePoolReport = {
  chainId: 8453;
  pairLabel: "MUSD/MEZO";
  pool: Address;
  factory: Address;
  token0: { address: Address; symbol: string; decimals: number };
  token1: { address: Address; symbol: string; decimals: number };
  tickSpacing: number;
  fee: string;
  tick: number;
  range: { tickLower: number; tickUpper: number };
  activeLiquidity: string;
  balances: Array<{ symbol: string; amount: string }>;
};

async function readTokenMetadata(
  client: PublicClient,
  address: Address,
  pool: Address,
): Promise<{ address: Address; symbol: string; decimals: number; balance: bigint }> {
  const [symbol, decimals, balance] = await Promise.all([
    client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address, abi: erc20Abi, functionName: "balanceOf", args: [pool] }),
  ]);
  return {
    address: getAddress(address),
    symbol,
    decimals: Number(decimals),
    balance: BigInt(balance),
  };
}

export async function buildBasePoolReport(input?: {
  client?: PublicClient;
}): Promise<BasePoolReport> {
  const client = input?.client ?? getBaseHttpClient();
  const resolvedPool = getAddress(
    await client.readContract({
      address: BASE_ADDRESSES.clFactory,
      abi: clFactoryAbi,
      functionName: "getPool",
      args: [BASE_ADDRESSES.mezo, BASE_ADDRESSES.musd, BASE_TICK_SPACING],
    }),
  );
  if (resolvedPool !== BASE_ADDRESSES.pool) {
    throw new Error(`Unexpected Base MUSD/MEZO pool: ${resolvedPool}`);
  }

  const [token0, token1, fee, tickSpacing, slot0, liquidity] = await Promise.all([
    client.readContract({ address: resolvedPool, abi: clPoolAbi, functionName: "token0" }),
    client.readContract({ address: resolvedPool, abi: clPoolAbi, functionName: "token1" }),
    client.readContract({ address: resolvedPool, abi: clPoolAbi, functionName: "fee" }),
    client.readContract({ address: resolvedPool, abi: clPoolAbi, functionName: "tickSpacing" }),
    client.readContract({ address: resolvedPool, abi: clPoolAbi, functionName: "slot0" }),
    client.readContract({ address: resolvedPool, abi: clPoolAbi, functionName: "liquidity" }),
  ]);
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

  const [metadata0, metadata1] = await Promise.all([
    readTokenMetadata(client, normalizedToken0, resolvedPool),
    readTokenMetadata(client, normalizedToken1, resolvedPool),
  ]);
  const tick = Number(slot0[1]);

  return {
    chainId: 8453,
    pairLabel: "MUSD/MEZO",
    pool: resolvedPool,
    factory: BASE_ADDRESSES.clFactory,
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
    balances: [
      { symbol: metadata0.symbol, amount: formatUnits(metadata0.balance, metadata0.decimals) },
      { symbol: metadata1.symbol, amount: formatUnits(metadata1.balance, metadata1.decimals) },
    ],
  };
}
