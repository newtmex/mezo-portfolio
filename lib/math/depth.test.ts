import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  amount0InToReachSqrt,
  amount1InToReachSqrt,
  depthDiffRatioBps,
  formatBpsPercent,
  managerActiveShareBps,
} from "./depth";
import { sqrtRatioAtTick, tightestRange } from "./tick-math";

describe("tightestRange", () => {
  it("forms a one-spacing band around the current tick", () => {
    assert.deepEqual(tightestRange(205, 200), { tickLower: 200, tickUpper: 400 });
    assert.deepEqual(tightestRange(-1, 200), { tickLower: -200, tickUpper: 0 });
  });
});

describe("managerActiveShareBps", () => {
  it("returns manager share of active liquidity in bps", () => {
    assert.equal(managerActiveShareBps(4_000n, 10_000n), 4_000n);
    assert.equal(managerActiveShareBps(0n, 10_000n), 0n);
    assert.equal(managerActiveShareBps(1n, 0n), null);
  });
});

describe("depthDiffRatioBps", () => {
  it("measures (with - without) / with in bps", () => {
    assert.equal(depthDiffRatioBps(100n, 60n), 4_000n);
    assert.equal(depthDiffRatioBps(0n, 0n), null);
  });
});

describe("formatBpsPercent", () => {
  it("formats 10_000 bps as 100.00%", () => {
    assert.equal(formatBpsPercent(4_000n), "40.00%");
    assert.equal(formatBpsPercent(null), "n/a");
  });
});

describe("amountInToReachSqrt", () => {
  it("returns zero when already past the target", () => {
    const sqrt = sqrtRatioAtTick(200);
    const lower = sqrtRatioAtTick(0);
    const upper = sqrtRatioAtTick(400);
    assert.equal(amount0InToReachSqrt(lower, sqrt, 1_000_000n, 500n), 0n);
    assert.equal(amount1InToReachSqrt(upper, sqrt, 1_000_000n, 500n), 0n);
  });

  it("returns positive depth when selling toward a boundary", () => {
    const mid = sqrtRatioAtTick(200);
    const lower = sqrtRatioAtTick(0);
    const upper = sqrtRatioAtTick(400);
    assert.ok(amount0InToReachSqrt(mid, lower, 1_000_000_000_000n, 500n) > 0n);
    assert.ok(amount1InToReachSqrt(mid, upper, 1_000_000_000_000n, 500n) > 0n);
  });
});
