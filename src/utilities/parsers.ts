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
