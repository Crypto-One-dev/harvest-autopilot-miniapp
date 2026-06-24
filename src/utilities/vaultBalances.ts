import type { HarvestVaultData, TokenInfo } from "~/types";

export function getSharePriceFromVaultData(
  vaultData: HarvestVaultData | null | undefined,
  underlyingDecimals: number,
): number {
  if (vaultData?.pricePerFullShare) {
    const decimals = vaultData.decimals ?? underlyingDecimals;
    return parseFloat(vaultData.pricePerFullShare) / Math.pow(10, decimals);
  }
  return 1;
}

export function getUnderlyingUsdPrice(
  vaultData: HarvestVaultData | null | undefined,
): number {
  if (vaultData?.usdPrice) {
    const price = parseFloat(vaultData.usdPrice);
    if (price > 0) return price;
  }
  return 1;
}

export function sharesToUnderlying(shares: number, sharePrice: number): number {
  return shares * sharePrice;
}

export function underlyingToShares(underlying: number, sharePrice: number): number {
  if (sharePrice <= 0) return underlying;
  return underlying / sharePrice;
}

export function getVaultUnderlyingBalance(
  vaultBalance: TokenInfo | null,
  vaultData: HarvestVaultData | null | undefined,
  underlyingDecimals: number,
): { underlying: number; usd: number } {
  const shareBalance = parseFloat(vaultBalance?.balance ?? "0");
  const sharePrice = getSharePriceFromVaultData(vaultData, underlyingDecimals);
  const underlyingUsdPrice = getUnderlyingUsdPrice(vaultData);

  let underlying = sharesToUnderlying(shareBalance, sharePrice);
  let usd = parseFloat(vaultBalance?.balanceUSD ?? "0");

  if (usd > 0 && underlyingUsdPrice > 0) {
    underlying = usd / underlyingUsdPrice;
  } else if (underlying > 0) {
    usd = underlying * underlyingUsdPrice;
  }

  return { underlying, usd };
}
