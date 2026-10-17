import { amount0InToReachSqrt, amount1InToReachSqrt } from "./depth";

const Q96 = 1n << 96n;

/** Integer square root via Newton iteration (floor). */
export function sqrtBigInt(value: bigint): bigint {
  if (value < 0n) throw new Error("sqrtBigInt requires a non-negative value.");
  if (value < 2n) return value;
  let x0 = value;
  let x1 = (value >> 1n) + 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x1 + value / x1) >> 1n;
  }
  return x0;
}

/** Human token1-per-token0 price from sqrtPriceX96. */
export function humanPriceToken1PerToken0(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): number {
  if (sqrtPriceX96 <= 0n) return Number.NaN;
  const ratio = Number(sqrtPriceX96) / Number(Q96);
  return ratio * ratio * 10 ** (decimals0 - decimals1);
}

/**
 * Encode human token1-per-token0 into sqrtPriceX96.
 * Uses 1 full token0 against `price * 10^decimals1` token1 units.
 */
export function sqrtPriceX96FromHumanPrice(
  humanPrice: number,
  decimals0: number,
  decimals1: number,
): bigint {
  if (!(humanPrice > 0) || !Number.isFinite(humanPrice)) {
    throw new Error("Target price must be a positive finite number.");
  }
  const amount0 = 10n ** BigInt(decimals0);
  // Keep ~18 decimals of price precision in the numerator.
  const priceScale = 10n ** 18n;
  const scaledPrice = BigInt(Math.round(humanPrice * Number(priceScale)));
  if (scaledPrice <= 0n) throw new Error("Target price rounds to zero.");
  const amount1 = (scaledPrice * 10n ** BigInt(decimals1)) / priceScale;
  if (amount1 <= 0n) throw new Error("Target price is too small for token decimals.");
  return encodeSqrtRatioX96(amount1, amount0);
}

/** Uniswap-style encodeSqrtRatioX96(amount1, amount0). */
export function encodeSqrtRatioX96(amount1: bigint, amount0: bigint): bigint {
  if (amount0 <= 0n || amount1 <= 0n) {
    throw new Error("encodeSqrtRatioX96 requires positive amounts.");
  }
  const numerator = amount1 << 192n;
  const ratioX192 = numerator / amount0;
  return sqrtBigInt(ratioX192);
}

export type BuyToken = 0 | 1;

export type SellToTargetResult =
  | {
      ok: true;
      buyToken: BuyToken;
      sellToken: BuyToken;
      amountRaw: bigint;
      targetSqrtPriceX96: bigint;
    }
  | {
      ok: false;
      buyToken: BuyToken;
      sellToken: BuyToken;
      reason: string;
    };

/**
 * Gross sell amount (including fee) of the complementary token to move spot
 * to `targetHumanPrice`, assuming constant `liquidity` (active L approximation).
 *
 * Buying token1 sells token0 and requires target < current.
 * Buying token0 sells token1 and requires target > current.
 */
export function sellAmountToReachHumanPrice(input: {
  sqrtPriceX96: bigint;
  targetHumanPrice: number;
  buyToken: BuyToken;
  liquidity: bigint;
  fee: bigint;
  decimals0: number;
  decimals1: number;
}): SellToTargetResult {
  const sellToken: BuyToken = input.buyToken === 0 ? 1 : 0;
  if (!(input.targetHumanPrice > 0) || !Number.isFinite(input.targetHumanPrice)) {
    return { ok: false, buyToken: input.buyToken, sellToken, reason: "Enter a positive target price." };
  }
  if (input.liquidity <= 0n) {
    return { ok: false, buyToken: input.buyToken, sellToken, reason: "No active liquidity." };
  }
  if (input.sqrtPriceX96 <= 0n) {
    return { ok: false, buyToken: input.buyToken, sellToken, reason: "Pool price is unavailable." };
  }

  let targetSqrt: bigint;
  try {
    targetSqrt = sqrtPriceX96FromHumanPrice(
      input.targetHumanPrice,
      input.decimals0,
      input.decimals1,
    );
  } catch (error) {
    return {
      ok: false,
      buyToken: input.buyToken,
      sellToken,
      reason: error instanceof Error ? error.message : "Invalid target price.",
    };
  }

  const currentHuman = humanPriceToken1PerToken0(
    input.sqrtPriceX96,
    input.decimals0,
    input.decimals1,
  );

  const nearSpot =
    Number.isFinite(currentHuman) &&
    currentHuman > 0 &&
    Math.abs(input.targetHumanPrice - currentHuman) / currentHuman < 1e-6;

  if (nearSpot || targetSqrt === input.sqrtPriceX96) {
    return {
      ok: true,
      buyToken: input.buyToken,
      sellToken,
      amountRaw: 0n,
      targetSqrtPriceX96: targetSqrt,
    };
  }

  if (input.buyToken === 1) {
    if (!(input.targetHumanPrice < currentHuman) || targetSqrt >= input.sqrtPriceX96) {
      return {
        ok: false,
        buyToken: input.buyToken,
        sellToken,
        reason: "Buying token1 requires a target below the current price.",
      };
    }
    return {
      ok: true,
      buyToken: input.buyToken,
      sellToken,
      amountRaw: amount0InToReachSqrt(input.sqrtPriceX96, targetSqrt, input.liquidity, input.fee),
      targetSqrtPriceX96: targetSqrt,
    };
  }

  if (!(input.targetHumanPrice > currentHuman) || targetSqrt <= input.sqrtPriceX96) {
    return {
      ok: false,
      buyToken: input.buyToken,
      sellToken,
      reason: "Buying token0 requires a target above the current price.",
    };
  }
  return {
    ok: true,
    buyToken: input.buyToken,
    sellToken,
    amountRaw: amount1InToReachSqrt(input.sqrtPriceX96, targetSqrt, input.liquidity, input.fee),
    targetSqrtPriceX96: targetSqrt,
  };
}
