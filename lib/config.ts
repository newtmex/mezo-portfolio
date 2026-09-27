import { type Address, getAddress, isAddress } from "viem";

export const MEZO_CHAIN_ID = 31612;

export const MEZO_EXPLORER =
  process.env.NEXT_PUBLIC_MEZO_EXPLORER?.trim() || "https://explorer.mezo.org";

export const MEZO_API_BASE =
  process.env.MEZO_API_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_MEZO_API_BASE_URL?.trim() ||
  "https://api.mezo.org";

export const MEZO_RPC_HTTP =
  process.env.MEZO_RPC_HTTP?.trim() ||
  process.env.NEXT_PUBLIC_MEZO_RPC_HTTP?.trim() ||
  "https://mezo-mainnet.boar.network";

export const MEZO_RPC_WSS =
  process.env.MEZO_RPC_WSS?.trim() ||
  process.env.NEXT_PUBLIC_MEZO_RPC_WSS?.trim() ||
  "wss://mezo-mainnet.boar.network";

export const ADDRESSES = {
  btc: getAddress("0x7b7C000000000000000000000000000000000000"),
  mezo: getAddress("0x7B7c000000000000000000000000000000000001"),
  musd: getAddress("0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186"),
  avBtcm: getAddress("0xf333171788dE7005695b2E8FB9cAE97Ba9c4dD7a"),
  avMezom: getAddress("0xb894b11A78B762c82Cb095148F5BC11DC93C3560"),
  clFactory: getAddress("0xBB24AF5c6fB88F1d191FA76055e30BF881BeEb79"),
  npm: getAddress("0x509Bc221df2B83927c695FA0bb0f5b21053C874c"),
} as const;

export type PairKey = "musd-avbtcm" | "mezo-musd" | "avbtcm-avmezom" | "mezo-btc";

export type PairConfig = {
  key: PairKey;
  label: string;
  tokenA: Address;
  tokenB: Address;
  knownPool?: Address;
  knownGauge?: Address;
};

export const PAIRS: readonly PairConfig[] = [
  {
    key: "musd-avbtcm",
    label: "MUSD/avBTCm",
    tokenA: ADDRESSES.musd,
    tokenB: ADDRESSES.avBtcm,
    knownPool: getAddress("0xB018BED3b3376cE95ee34db170348FA16d18e29D"),
    knownGauge: getAddress("0xC5d9ddC440759CCe340c745a6133c7A29E90cF94"),
  },
  {
    key: "mezo-musd",
    label: "MEZO/MUSD",
    tokenA: ADDRESSES.mezo,
    tokenB: ADDRESSES.musd,
    knownPool: getAddress("0x1D6e8D24c133535F2d00676F66a0e824f84765ff"),
    knownGauge: getAddress("0xa763cEE0cBE643e2381CE2B0C457b4451d59C40D"),
  },
  {
    key: "mezo-btc",
    label: "MEZO/BTC",
    tokenA: ADDRESSES.mezo,
    tokenB: ADDRESSES.btc,
    knownPool: getAddress("0x907D055978943c69cffD5eD969F5603Af104aCc5"),
  },
  {
    key: "avbtcm-avmezom",
    label: "avBTCm/avMEZOm",
    tokenA: ADDRESSES.avBtcm,
    tokenB: ADDRESSES.avMezom,
    knownPool: getAddress("0xE639b9B1fb72C8ea2Fea246Ba0ad0ed7ddfB0E1C"),
    knownGauge: getAddress("0xCd1b3cAB8715e66a5c00F420C84742f6406059eF"),
  },
] as const;

export const TRACKED_TOKENS = [
  { symbol: "BTC", address: ADDRESSES.btc },
  { symbol: "MEZO", address: ADDRESSES.mezo },
  { symbol: "MUSD", address: ADDRESSES.musd },
  { symbol: "avBTCm", address: ADDRESSES.avBtcm },
  { symbol: "avMEZOm", address: ADDRESSES.avMezom },
] as const;

function readManagerAddress(): Address | null {
  const raw =
    process.env.MANAGER_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_MANAGER_ADDRESS?.trim() ||
    null;
  if (!raw) return null;
  if (!isAddress(raw)) {
    throw new Error(`Invalid MANAGER_ADDRESS: ${raw}`);
  }
  return getAddress(raw);
}

export function getManagerAddress(): Address {
  const address = readManagerAddress();
  if (!address) {
    throw new Error(
      "MANAGER_ADDRESS (or NEXT_PUBLIC_MANAGER_ADDRESS) must be set to the gauge manager wallet.",
    );
  }
  return address;
}

export function getManagerAddressOrNull(): Address | null {
  try {
    return readManagerAddress();
  } catch {
    return null;
  }
}
