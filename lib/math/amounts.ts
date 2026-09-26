import { sqrtRatioAtTick } from "./tick-math";

const Q96 = 1n << 96n;

function amount0Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  const lower = sqrtA < sqrtB ? sqrtA : sqrtB;
  const upper = sqrtA < sqrtB ? sqrtB : sqrtA;
  return ((liquidity << 96n) * (upper - lower)) / upper / lower;
}

function amount1Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  const lower = sqrtA < sqrtB ? sqrtA : sqrtB;
  const upper = sqrtA < sqrtB ? sqrtB : sqrtA;
  return (liquidity * (upper - lower)) / Q96;
}

export function amountsForLiquidity(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): { amount0: bigint; amount1: bigint } {
  const sqrtA = sqrtRatioAtTick(tickLower);
  const sqrtB = sqrtRatioAtTick(tickUpper);
  if (sqrtPriceX96 <= sqrtA) {
    return { amount0: amount0Delta(sqrtA, sqrtB, liquidity), amount1: 0n };
  }
  if (sqrtPriceX96 >= sqrtB) {
    return { amount0: 0n, amount1: amount1Delta(sqrtA, sqrtB, liquidity) };
  }
  return {
    amount0: amount0Delta(sqrtPriceX96, sqrtB, liquidity),
    amount1: amount1Delta(sqrtA, sqrtPriceX96, liquidity),
  };
}
