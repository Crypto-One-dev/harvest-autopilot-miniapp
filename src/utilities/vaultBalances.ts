import BigNumber from "bignumber.js";
import type { HarvestVaultData, TokenInfo, VaultInfo } from "~/types";
import { parseTokenUnits } from "~/utilities/parsers";

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

export function adjustVaultShareBalance(
  vaultBalance: TokenInfo,
  vault: VaultInfo,
  vaultData: HarvestVaultData | null | undefined,
  underlyingAmount: number,
  direction: "add" | "remove",
): TokenInfo {
  const sharePrice = getSharePriceFromVaultData(vaultData, vault.decimals);
  const shareDelta = underlyingToShares(underlyingAmount, sharePrice);
  const currentShares = new BigNumber(vaultBalance.balance || "0");
  const nextShares =
    direction === "remove"
      ? BigNumber.max(0, currentShares.minus(shareDelta))
      : currentShares.plus(shareDelta);

  const currentRaw = new BigNumber(vaultBalance.rawBalance || "0");
  const rawDelta = new BigNumber(
    parseTokenUnits(shareDelta.toString(), vault.vaultDecimals).toString(),
  );
  const nextRaw =
    direction === "remove"
      ? BigNumber.max(0, currentRaw.minus(rawDelta))
      : currentRaw.plus(rawDelta);

  const currentUsd = new BigNumber(vaultBalance.balanceUSD || "0");
  const usdPerShare = currentShares.gt(0)
    ? currentUsd.div(currentShares)
    : new BigNumber(0);
  const nextUsd = usdPerShare.times(nextShares);

  return {
    ...vaultBalance,
    balance: nextShares.toString(),
    rawBalance: nextRaw.toString(),
    balanceUSD: nextUsd.toString(),
  };
}

export function adjustWalletTokenBalance(
  token: TokenInfo,
  amount: number,
  direction: "add" | "remove",
): TokenInfo {
  const currentRaw = new BigNumber(token.rawBalance || "0");
  const deltaRaw = new BigNumber(
    parseTokenUnits(amount.toString(), token.decimals).toString(),
  );
  const nextRaw =
    direction === "remove"
      ? BigNumber.max(0, currentRaw.minus(deltaRaw))
      : currentRaw.plus(deltaRaw);
  const nextBalance = nextRaw.div(new BigNumber(10).pow(token.decimals));
  const price = new BigNumber(token.price || "0");

  return {
    ...token,
    balance: nextBalance.toString(),
    rawBalance: nextRaw.toString(),
    balanceUSD: price.times(nextBalance).toString(),
  };
}
