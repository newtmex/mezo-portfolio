const Q96 = 1n << 96n;
const FEE_DENOMINATOR = 1_000_000n;
const PERCENT_SCALE = 10_000n;

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("ceilDiv requires a positive denominator");
  return numerator === 0n ? 0n : (numerator - 1n) / denominator + 1n;
}

function amount0Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  const lower = sqrtA < sqrtB ? sqrtA : sqrtB;
  const upper = sqrtA < sqrtB ? sqrtB : sqrtA;
  return ceilDiv(ceilDiv((liquidity << 96n) * (upper - lower), upper), lower);
}

function amount1Delta(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  const lower = sqrtA < sqrtB ? sqrtA : sqrtB;
  const upper = sqrtA < sqrtB ? sqrtB : sqrtA;
  return ceilDiv(liquidity * (upper - lower), Q96);
}

function grossInputForNet(netInput: bigint, fee: bigint): bigint {
  if (fee >= FEE_DENOMINATOR) throw new Error(`Invalid pool fee ${fee.toString()}.`);
  return ceilDiv(netInput * FEE_DENOMINATOR, FEE_DENOMINATOR - fee);
}

/** Gross token0 in (including fee) to reach `target` from `sqrt` when selling token0. */
export function amount0InToReachSqrt(
  sqrt: bigint,
  target: bigint,
  liquidity: bigint,
  fee: bigint,
): bigint {
  if (liquidity === 0n || target >= sqrt) return 0n;
  const net = amount0Delta(sqrt, target, liquidity);
  return grossInputForNet(net, fee);
}

/** Gross token1 in (including fee) to reach `target` from `sqrt` when selling token1. */
export function amount1InToReachSqrt(
  sqrt: bigint,
  target: bigint,
  liquidity: bigint,
  fee: bigint,
): bigint {
  if (liquidity === 0n || target <= sqrt) return 0n;
  const net = amount1Delta(sqrt, target, liquidity);
  return grossInputForNet(net, fee);
}

/**
 * Positive index of how much the with-manager depth exceeds the without-manager
 * depth, relative to with-manager: `(with - without) / with`.
 */
export function depthDiffRatioBps(withAmount: bigint, withoutAmount: bigint): bigint | null {
  if (withAmount <= 0n) return null;
  const delta = withAmount > withoutAmount ? withAmount - withoutAmount : 0n;
  return (delta * PERCENT_SCALE) / withAmount;
}

export function managerActiveShareBps(
  managerLiquidity: bigint,
  activeLiquidity: bigint,
): bigint | null {
  if (activeLiquidity <= 0n) return null;
  if (managerLiquidity <= 0n) return 0n;
  const capped = managerLiquidity > activeLiquidity ? activeLiquidity : managerLiquidity;
  return (capped * PERCENT_SCALE) / activeLiquidity;
}

/** Formats basis points where 10_000 = 100% (e.g. 4000 → "40.00%"). */
export function formatBpsPercent(bps: bigint | null): string {
  if (bps === null) return "n/a";
  const negative = bps < 0n;
  const abs = negative ? -bps : bps;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${negative ? "-" : ""}${whole.toString()}.${frac.toString().padStart(2, "0")}%`;
}
