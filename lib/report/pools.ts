import {
  getAddress,
  type Address,
  type PublicClient,
  zeroAddress,
} from "viem";

import { clFactoryAbi, clPoolAbi } from "../abis";
import { ADDRESSES } from "../config";

export type ClPoolSnapshot = {
  address: Address;
  tickSpacing: number;
  token0: Address;
  token1: Address;
  fee: bigint;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  gauge: Address;
};

async function readPoolSnapshot(
  client: PublicClient,
  address: Address,
  tickSpacingHint?: number,
): Promise<ClPoolSnapshot> {
  const [token0, token1, fee, slot0, liquidity, gauge, tickSpacing] = await Promise.all([
    client.readContract({ address, abi: clPoolAbi, functionName: "token0" }),
    client.readContract({ address, abi: clPoolAbi, functionName: "token1" }),
    client.readContract({ address, abi: clPoolAbi, functionName: "fee" }),
    client.readContract({ address, abi: clPoolAbi, functionName: "slot0" }),
    client.readContract({ address, abi: clPoolAbi, functionName: "liquidity" }),
    client.readContract({ address, abi: clPoolAbi, functionName: "gauge" }),
    tickSpacingHint != null
      ? Promise.resolve(tickSpacingHint)
      : client.readContract({ address, abi: clPoolAbi, functionName: "tickSpacing" }),
  ]);

  return {
    address: getAddress(address),
    tickSpacing: Number(tickSpacing),
    token0: getAddress(token0),
    token1: getAddress(token1),
    fee: BigInt(fee),
    sqrtPriceX96: BigInt(slot0[0]),
    tick: Number(slot0[1]),
    liquidity: BigInt(liquidity),
    gauge: getAddress(gauge),
  };
}

/** Resolve the most-liquid official Mezo CL pool for a token pair. */
export async function resolveMostLiquidClPool(
  client: PublicClient,
  tokenA: Address,
  tokenB: Address,
  pairLabel: string,
  knownPool?: Address,
): Promise<ClPoolSnapshot> {
  const spacings = await client.readContract({
    address: ADDRESSES.clFactory,
    abi: clFactoryAbi,
    functionName: "tickSpacings",
  });

  let selected: ClPoolSnapshot | undefined;
  for (const spacing of spacings) {
    const address = getAddress(
      await client.readContract({
        address: ADDRESSES.clFactory,
        abi: clFactoryAbi,
        functionName: "getPool",
        args: [tokenA, tokenB, spacing],
      }),
    );
    if (address === zeroAddress) continue;
    const snapshot = await readPoolSnapshot(client, address, Number(spacing));
    if (!selected || snapshot.liquidity > selected.liquidity) selected = snapshot;
  }

  if (!selected && knownPool) {
    selected = await readPoolSnapshot(client, knownPool);
  }

  if (!selected) {
    throw new Error(`No Mezo ${pairLabel} concentrated-liquidity pool exists.`);
  }
  if (selected.sqrtPriceX96 === 0n) {
    throw new Error(`${pairLabel} pool ${selected.address} is not initialized.`);
  }
  if (selected.gauge === zeroAddress) {
    throw new Error(`${pairLabel} pool ${selected.address} has no gauge.`);
  }
  return selected;
}
