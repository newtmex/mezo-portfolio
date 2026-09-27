import { MEZO_API_BASE } from "../config";

const MEZO_ORIGIN = "https://mezo.org";

function parseNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
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
