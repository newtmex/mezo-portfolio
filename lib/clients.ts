import {
  createPublicClient,
  defineChain,
  fallback,
  http,
  webSocket,
  type PublicClient,
} from "viem";

import {
  BASE_CHAIN_ID,
  BASE_RPC_HTTP_FALLBACKS,
  MEZO_CHAIN_ID,
  MEZO_EXPLORER,
  MEZO_RPC_HTTP,
  MEZO_RPC_WSS,
} from "./config";

const MEZO_MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
const BASE_MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11" as const;

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
  contracts: {
    multicall3: {
      address: MEZO_MULTICALL3,
    },
  },
});

export const baseMainnet = defineChain({
  id: BASE_CHAIN_ID,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: BASE_RPC_HTTP_FALLBACKS },
  },
  contracts: {
    multicall3: {
      address: BASE_MULTICALL3,
    },
  },
});

let httpClient: PublicClient | null = null;
let baseHttpClient: PublicClient | null = null;

export function getHttpClient(): PublicClient {
  if (!httpClient) {
    httpClient = createPublicClient({
      chain: mezoMainnet,
      transport: http(MEZO_RPC_HTTP, { timeout: 30_000 }),
    });
  }
  return httpClient;
}

export function getBaseHttpClient(): PublicClient {
  if (!baseHttpClient) {
    baseHttpClient = createPublicClient({
      chain: baseMainnet,
      transport: fallback(
        BASE_RPC_HTTP_FALLBACKS.map((url) => http(url, { timeout: 15_000, retryCount: 0 })),
        { rank: false, retryCount: 0 },
      ),
    });
  }
  return baseHttpClient;
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
