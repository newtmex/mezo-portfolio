import { formatUnits } from "viem";

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/**
 * Annualized live MEZO incentives over the value of the pool's staked active
 * liquidity. The staked value is estimated pro-rata from the pool TVL because
 * CL liquidity is reported in sqrt-price units rather than token units.
 */
export function activeLiquidityAprPercent(input: {
  rewardRate: bigint;
  mezoPriceMusd: number | null;
  poolTvlMusd: number | null;
  activeLiquidity: bigint;
  stakedLiquidity: bigint;
}): number | null {
  if (input.rewardRate === 0n) return 0;
  if (
    input.mezoPriceMusd == null ||
    !(input.mezoPriceMusd > 0) ||
    input.poolTvlMusd == null ||
    !(input.poolTvlMusd > 0) ||
    input.activeLiquidity <= 0n ||
    input.stakedLiquidity <= 0n
  ) {
    return null;
  }

  const stakedLiquidity =
    input.stakedLiquidity > input.activeLiquidity ? input.activeLiquidity : input.stakedLiquidity;
  const stakedTvlMusd =
    input.poolTvlMusd * (Number(stakedLiquidity) / Number(input.activeLiquidity));
  if (!(stakedTvlMusd > 0) || !Number.isFinite(stakedTvlMusd)) return null;

  const annualMezoMusd =
    Number(formatUnits(input.rewardRate, 18)) * SECONDS_PER_YEAR * input.mezoPriceMusd;
  const apr = (annualMezoMusd / stakedTvlMusd) * 100;
  return Number.isFinite(apr) && apr >= 0 ? apr : null;
}
