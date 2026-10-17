import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sqrtRatioAtTick } from "./tick-math";
import {
  encodeSqrtRatioX96,
  humanPriceToken1PerToken0,
  sellAmountToReachHumanPrice,
  sqrtBigInt,
  sqrtPriceX96FromHumanPrice,
} from "./price";

describe("sqrtBigInt", () => {
  it("returns floor square roots", () => {
    assert.equal(sqrtBigInt(0n), 0n);
    assert.equal(sqrtBigInt(1n), 1n);
    assert.equal(sqrtBigInt(15n), 3n);
    assert.equal(sqrtBigInt(16n), 4n);
  });
});

describe("human price encode/decode", () => {
  it("round-trips a mid-range price for equal decimals", () => {
    const human = 1.25;
    const encoded = sqrtPriceX96FromHumanPrice(human, 18, 18);
    const decoded = humanPriceToken1PerToken0(encoded, 18, 18);
    assert.ok(Math.abs(decoded - human) / human < 1e-6);
  });

  it("matches tick-derived prices for equal decimals", () => {
    const sqrt = sqrtRatioAtTick(0);
    const human = humanPriceToken1PerToken0(sqrt, 18, 18);
    assert.ok(Math.abs(human - 1) < 1e-9);
  });

  it("encodes ratio amounts via encodeSqrtRatioX96", () => {
    const one = 10n ** 18n;
    const sqrt = encodeSqrtRatioX96(one, one);
    assert.equal(sqrt, 1n << 96n);
  });
});

describe("sellAmountToReachHumanPrice", () => {
  const sqrt = sqrtRatioAtTick(0);
  const fee = 500n;
  const liquidity = 1_000_000_000_000_000n;

  it("sells token0 when buying token1 toward a lower price", () => {
    const result = sellAmountToReachHumanPrice({
      sqrtPriceX96: sqrt,
      targetHumanPrice: 0.99,
      buyToken: 1,
      liquidity,
      fee,
      decimals0: 18,
      decimals1: 18,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sellToken, 0);
    assert.ok(result.amountRaw > 0n);
  });

  it("sells token1 when buying token0 toward a higher price", () => {
    const result = sellAmountToReachHumanPrice({
      sqrtPriceX96: sqrt,
      targetHumanPrice: 1.01,
      buyToken: 0,
      liquidity,
      fee,
      decimals0: 18,
      decimals1: 18,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sellToken, 1);
    assert.ok(result.amountRaw > 0n);
  });

  it("rejects the wrong side of the market for the buy token", () => {
    const tooHigh = sellAmountToReachHumanPrice({
      sqrtPriceX96: sqrt,
      targetHumanPrice: 1.01,
      buyToken: 1,
      liquidity,
      fee,
      decimals0: 18,
      decimals1: 18,
    });
    assert.equal(tooHigh.ok, false);

    const tooLow = sellAmountToReachHumanPrice({
      sqrtPriceX96: sqrt,
      targetHumanPrice: 0.99,
      buyToken: 0,
      liquidity,
      fee,
      decimals0: 18,
      decimals1: 18,
    });
    assert.equal(tooLow.ok, false);
  });
});
