import { createPublicClient, defineChain, http, webSocket, type PublicClient } from "viem";

import { MEZO_CHAIN_ID, MEZO_EXPLORER, MEZO_RPC_HTTP, MEZO_RPC_WSS } from "./config";

export const mezoMainnet = defineChain({
  id: MEZO_CHAIN_ID,
  name: "Mezo Mainnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [MEZO_RPC_HTTP],
      webSocket: [MEZO_RPC_WSS],
    },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: MEZO_EXPLORER },
  },
});

let httpClient: PublicClient | null = null;

export function getHttpClient(): PublicClient {
  if (!httpClient) {
    httpClient = createPublicClient({
      chain: mezoMainnet,
      transport: http(MEZO_RPC_HTTP, { timeout: 30_000 }),
    });
  }
  return httpClient;
}

export function createWsClient(): PublicClient {
  return createPublicClient({
    chain: mezoMainnet,
    transport: webSocket(MEZO_RPC_WSS, {
      reconnect: true,
      retryCount: 10,
    }),
  });
}
