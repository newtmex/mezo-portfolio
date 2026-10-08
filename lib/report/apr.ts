const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/** Annualized USD value of active gauge emissions over USD value of in-range liquidity. */
export function activeLiquidityAprPercent(input: {
  annualRewardValueMusd: number;
  inRangeLiquidityValueMusd: number | null;
}): number | null {
  if (input.annualRewardValueMusd === 0) return 0;
  if (
    !Number.isFinite(input.annualRewardValueMusd) ||
    input.annualRewardValueMusd < 0 ||
    input.inRangeLiquidityValueMusd == null ||
    !(input.inRangeLiquidityValueMusd > 0) ||
    !Number.isFinite(input.inRangeLiquidityValueMusd)
  ) {
    return null;
  }

  const apr = (input.annualRewardValueMusd / input.inRangeLiquidityValueMusd) * 100;
  return Number.isFinite(apr) && apr >= 0 ? apr : null;
}

export function annualEmissionValueMusd(input: {
  rewardRate: bigint;
  rewardDecimals: number;
  rewardPriceMusd: number | null;
}): number | null {
  if (input.rewardRate === 0n) return 0;
  if (
    input.rewardPriceMusd == null ||
    !(input.rewardPriceMusd > 0) ||
    !Number.isFinite(input.rewardPriceMusd) ||
    input.rewardDecimals < 0
  ) {
    return null;
  }

  const tokensPerSecond = Number(input.rewardRate) / 10 ** input.rewardDecimals;
  const annualValue = tokensPerSecond * SECONDS_PER_YEAR * input.rewardPriceMusd;
  return Number.isFinite(annualValue) ? annualValue : null;
}
