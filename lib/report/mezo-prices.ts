import { MEZO_API_BASE } from "../config";
import { ADDRESSES } from "../config";
import { clPoolAbi } from "../abis";
import { getHttpClient } from "../clients";

const MEZO_ORIGIN = "https://mezo.org";
const Q192 = 1n << 192n;
const UNIT = 10n ** 18n;

function parseNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

async function readPoolSpotPrice(input: {
  pool: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
}): Promise<number | null> {
  const client = getHttpClient();
  const [token0, token1, slot0] = await Promise.all([
    client.readContract({ address: input.pool, abi: clPoolAbi, functionName: "token0" }),
    client.readContract({ address: input.pool, abi: clPoolAbi, functionName: "token1" }),
    client.readContract({ address: input.pool, abi: clPoolAbi, functionName: "slot0" }),
  ]);
  const sqrtPriceX96 = BigInt(slot0[0]);
  if (sqrtPriceX96 <= 0n) return null;
  const squared = sqrtPriceX96 * sqrtPriceX96;
  const rawOut = token0.toLowerCase() === input.tokenIn.toLowerCase()
    ? (UNIT * squared) / Q192
    : token1.toLowerCase() === input.tokenIn.toLowerCase()
      ? (UNIT * Q192) / squared
      : null;
  if (rawOut == null || token0.toLowerCase() !== input.tokenOut.toLowerCase() && token1.toLowerCase() !== input.tokenOut.toLowerCase()) return null;
  const price = Number(rawOut) / 1e18;
  return Number.isFinite(price) && price > 0 ? price : null;
}

async function addAuroveWrapperPrices(prices: Map<string, number>) {
  try {
    const avBtcmMusd = await readPoolSpotPrice({
      pool: ADDRESSES.musdAvBtcmPool,
      tokenIn: ADDRESSES.avBtcm,
      tokenOut: ADDRESSES.musd,
    });
    if (avBtcmMusd != null) {
      prices.set(ADDRESSES.avBtcm.toLowerCase(), avBtcmMusd);
      prices.set("avbtcm", avBtcmMusd);
    }

    if (!prices.has(ADDRESSES.avMezom.toLowerCase()) && avBtcmMusd != null) {
      const avMezomAvBtcm = await readPoolSpotPrice({
        pool: ADDRESSES.avBtcmAvMezomPool,
        tokenIn: ADDRESSES.avMezom,
        tokenOut: ADDRESSES.avBtcm,
      });
      if (avMezomAvBtcm != null) {
        const avMezomMusd = avMezomAvBtcm * avBtcmMusd;
        prices.set(ADDRESSES.avMezom.toLowerCase(), avMezomMusd);
        prices.set("avmezom", avMezomMusd);
      }
    }
  } catch (error) {
    console.error("[mezo-prices] Failed to derive Aurove wrapper prices on-chain", error);
  }
}

/** Build symbol/address → mUSD price map from Mezo `/tokens` + `/pools`. */
export async function fetchMezoPriceMapMusd(): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const requestInit: RequestInit & { next?: { revalidate: number } } = {
    headers: {
      accept: "application/json",
      origin: MEZO_ORIGIN,
      referer: `${MEZO_ORIGIN}/earn/pools`,
    },
    next: { revalidate: 30 },
  };
  const endpoints = [
    fetch(`${MEZO_API_BASE}/tokens`, requestInit),
    fetch(`${MEZO_API_BASE}/pools`, requestInit),
  ];
  const [tokensRes, poolsRes] = await Promise.all(endpoints);

  const logFailedResponse = async (endpoint: string, response: Response) => {
    if (response.ok) return;
    let body = "";
    try {
      body = await response.clone().text();
    } catch {
      body = "<unable to read response body>";
    }
    console.error("[mezo-prices] Mezo API request failed", {
      endpoint,
      status: response.status,
      statusText: response.statusText,
      body,
    });
  };

  await Promise.all([
    logFailedResponse(`${MEZO_API_BASE}/tokens`, tokensRes),
    logFailedResponse(`${MEZO_API_BASE}/pools`, poolsRes),
  ]);

  const remember = (address: unknown, symbol: unknown, price: unknown) => {
    const parsed = parseNumber(price);
    if (parsed == null || !(parsed > 0)) return;
    if (typeof symbol === "string" && symbol.trim()) {
      const key = symbol.trim().toLowerCase();
      if (!prices.has(key)) prices.set(key, parsed);
    }
    if (typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address)) {
      const key = address.toLowerCase();
      if (!prices.has(key)) prices.set(key, parsed);
    }
  };

  if (tokensRes.ok) {
    const body = (await tokensRes.json()) as {
      success?: boolean;
      data?: Array<{ address?: unknown; symbol?: unknown; price?: unknown }>;
    };
    if (body.success && Array.isArray(body.data)) {
      for (const token of body.data) remember(token.address, token.symbol, token.price);
    }
  }

  if (poolsRes.ok) {
    const body = (await poolsRes.json()) as {
      success?: boolean;
      data?: Array<{
        token0?: { address?: unknown; symbol?: unknown; price?: unknown };
        token1?: { address?: unknown; symbol?: unknown; price?: unknown };
      }>;
    };
    if (body.success && Array.isArray(body.data)) {
      for (const pool of body.data) {
        remember(pool.token0?.address, pool.token0?.symbol, pool.token0?.price);
        remember(pool.token1?.address, pool.token1?.symbol, pool.token1?.price);
      }
    }
  }

  await addAuroveWrapperPrices(prices);

  return prices;
}

export function lookupPriceMusd(
  prices: ReadonlyMap<string, number>,
  address: string,
  symbol?: string,
): number | null {
  const byAddress = prices.get(address.toLowerCase());
  if (byAddress != null) return byAddress;
  if (symbol) {
    const bySymbol = prices.get(symbol.toLowerCase());
    if (bySymbol != null) return bySymbol;
  }
  return null;
}

export function valueRawAmountMusd(
  amountRaw: bigint,
  decimals: number,
  priceMusd: number | null,
): number | null {
  if (priceMusd == null || !(priceMusd > 0) || decimals < 0) return null;
  const amount = Number(amountRaw) / 10 ** decimals;
  if (!Number.isFinite(amount)) return null;
  const value = amount * priceMusd;
  return Number.isFinite(value) ? value : null;
}
