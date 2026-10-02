import assert from "node:assert/strict";
import test from "node:test";

import { activeLiquidityAprPercent } from "./apr";

test("active liquidity APR annualizes live MEZO rewards over staked active TVL", () => {
  assert.equal(
    activeLiquidityAprPercent({
      rewardRate: 1_000_000_000_000n,
      mezoPriceMusd: 2,
      poolTvlMusd: 10_000,
      activeLiquidity: 100n,
      stakedLiquidity: 50n,
    }),
    1.26144,
  );
});

test("active liquidity APR caps staked liquidity at active liquidity", () => {
  const apr = activeLiquidityAprPercent({
    rewardRate: 1_000_000_000_000n,
    mezoPriceMusd: 2,
    poolTvlMusd: 10_000,
    activeLiquidity: 100n,
    stakedLiquidity: 200n,
  });
  assert.equal(apr, 0.63072);
});

test("active liquidity APR is zero without live rewards and unavailable without inputs", () => {
  assert.equal(
    activeLiquidityAprPercent({
      rewardRate: 0n,
      mezoPriceMusd: null,
      poolTvlMusd: null,
      activeLiquidity: 0n,
      stakedLiquidity: 0n,
    }),
    0,
  );
  assert.equal(
    activeLiquidityAprPercent({
      rewardRate: 1n,
      mezoPriceMusd: null,
      poolTvlMusd: 10_000,
      activeLiquidity: 100n,
      stakedLiquidity: 50n,
    }),
    null,
  );
});
