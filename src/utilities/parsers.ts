import BigNumber from "bignumber.js";

export function formatTVL(value: string): string {
  const num = parseFloat(value);
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }
  return `$${num.toFixed(2)}`;
}

export function formatBalance(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === 0) return "0";
  if (num < 0.000001) return "<0.000001";
  return num.toFixed(6).replace(/\.?0+$/, "");
}

export function formatUsd(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num) || num === 0) return "$0";
  if (num < 0.01) return "<$0.01";
  if (num >= 1000) {
    return `$${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${formatBalance(num)}`;
}

export function formatCtaAmount(value: string | number): string {
  return formatBalance(value);
}

export function getChainNamePortals(chainId: number): string {
  switch (chainId) {
    case 1:
      return "ethereum";
    case 137:
      return "polygon";
    case 42161:
      return "arbitrum";
    case 8453:
      return "base";
    default:
      return "ethereum";
  }
}

export const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 14)}...${address.slice(-12)}`;
};

export function parseTokenUnits(value: string, decimals: number): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  const normalizedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${whole}${normalizedFraction}`);
}

/** Full-precision human amount from base units (for internal / on-chain use). */
export function formatTokenUnits(raw: bigint | string, decimals: number): string {
  const rawBn = new BigNumber(raw.toString());
  if (rawBn.isZero()) return "0";
  return rawBn.div(new BigNumber(10).pow(decimals)).toString();
}

/** Human amount capped at 6 decimals for UI display. */
export function formatTokenUnitsForDisplay(
  raw: bigint | string,
  decimals: number,
): string {
  return formatBalance(formatTokenUnits(raw, decimals));
}
