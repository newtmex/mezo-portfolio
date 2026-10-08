import assert from "node:assert/strict";
import test from "node:test";

import { activeLiquidityAprPercent, annualEmissionValueMusd } from "./apr";

test("active liquidity APR divides annual USD emissions by USD in-range liquidity", () => {
  const annualMezo = annualEmissionValueMusd({
    rewardRate: 1_000_000_000_000n,
    rewardDecimals: 18,
    rewardPriceMusd: 2,
  });
  const annualAero = annualEmissionValueMusd({
    rewardRate: 2_000_000_000_000n,
    rewardDecimals: 18,
    rewardPriceMusd: 1,
  });
  assert.equal(annualMezo, 63.072);
  assert.equal(annualAero, 63.072);
  assert.equal(
    activeLiquidityAprPercent({
      annualRewardValueMusd: annualMezo! + annualAero!,
      inRangeLiquidityValueMusd: 10_000,
    }),
    1.26144,
  );
});

test("active liquidity APR reports zero without emissions", () => {
  assert.equal(
    activeLiquidityAprPercent({
      annualRewardValueMusd: 0,
      inRangeLiquidityValueMusd: null,
    }),
    0,
  );
});

test("active liquidity APR is unavailable without priced in-range liquidity", () => {
  assert.equal(
    activeLiquidityAprPercent({
      annualRewardValueMusd: 10,
      inRangeLiquidityValueMusd: null,
    }),
    null,
  );
  assert.equal(
    annualEmissionValueMusd({
      rewardRate: 1n,
      rewardDecimals: 18,
      rewardPriceMusd: null,
    }),
    null,
  );
});
