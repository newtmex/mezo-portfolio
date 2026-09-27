export type DepthSide = {
  token: string;
  symbol: string;
  amount: string;
  formatted: string;
};

export type ClRangeDepthReport = {
  pairLabel: string;
  pool: string;
  gauge: string;
  tickSpacing: number;
  fee: string;
  tick: number;
  range: { tickLower: number; tickUpper: number };
  sqrtPriceX96: string;
  priceToken1PerToken0: number;
  token0: { address: string; symbol: string };
  token1: { address: string; symbol: string };
  manager: string | null;
  managerInRangeLiquidity: string;
  managerStakedInRangeLiquidity: string;
  managerTokenIds: string[];
  managerStakedTokenIds: string[];
  activeLiquidity: string;
  activeLiquidityWithoutManager: string;
  managerActiveLiquidityShareBps: string | null;
  managerStakedActiveLiquidityShareBps: string | null;
  managerActiveLiquidityShare: string;
  priceMoveDepthDiffBps: {
    sellToken0ToLeaveLower: string | null;
    sellToken1ToLeaveUpper: string | null;
  };
  priceMoveDepthDiff: {
    sellToken0ToLeaveLower: string;
    sellToken1ToLeaveUpper: string;
  };
  scenarios: Array<{
    label: string;
    liquidity: string;
    sellToken0ToLeaveLower: DepthSide;
    sellToken1ToLeaveUpper: DepthSide;
  }>;
};

export type ManagerTokenHolding = {
  symbol: string;
  address: string;
  amountRaw: string;
  amount: string;
  priceMusd: number | null;
  valueMusd: number | null;
};

export type ManagerClPositionValue = {
  pair: string;
  tokenId: string;
  staked: boolean;
  tickLower: number;
  tickUpper: number;
  inRange: boolean;
  amount0: string;
  amount1: string;
  symbol0: string;
  symbol1: string;
  valueMusd: number | null;
};

export type ManagerRangeDepthSummaryRow = {
  pair: string;
  managerActivePct: string;
  managerActiveBps: string | null;
  managerL: string;
  activeL: string;
  depthDiffToken0: string;
  depthDiffToken1: string;
};

export type ManagerRangeDepthPayload = {
  network: "mainnet";
  chainId: number;
  manager: string;
  fetchedAt: string;
  holdings: {
    tokens: ManagerTokenHolding[];
    clPositions: ManagerClPositionValue[];
    tokenTotalMusd: number | null;
    clTotalMusd: number | null;
    portfolioTotalMusd: number | null;
  };
  summary: ManagerRangeDepthSummaryRow[];
  pools: ClRangeDepthReport[];
  emissions: {
    mezoPerDay: number | null;
    valueMusdPerDay: number | null;
  };
};
