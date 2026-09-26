export type LiveEventKind =
  | "Swap"
  | "Mint"
  | "Burn"
  | "Transfer"
  | "IncreaseLiquidity"
  | "DecreaseLiquidity"
  | "Deposit"
  | "Withdraw";

export type LiveEventItem = {
  id: string;
  kind: LiveEventKind;
  source: string;
  summary: string;
  txHash: `0x${string}`;
  blockNumber: string;
  at: string;
};

export type WsConnectionState = "connecting" | "connected" | "reconnecting" | "error" | "idle";
