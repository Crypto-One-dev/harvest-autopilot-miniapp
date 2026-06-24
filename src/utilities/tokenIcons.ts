import { FALLBACK_TOKEN_ICON } from "~/constants";
import type { TokenInfo } from "~/types";

const TOKEN_ICON_MAP: Record<string, string> = {
  ETH: "/images/tokens/eth.svg",
  WETH: "/images/tokens/eth.svg",
  USDC: "/images/tokens/usdc.svg",
  cbBTC: "/images/tokens/cbbtc.svg",
  CBBTC: "/images/tokens/cbbtc.svg",
};

export function getTokenIconPath(
  token: Pick<TokenInfo, "symbol" | "icon">,
): string {
  if (token.icon?.startsWith("/images/tokens/")) {
    return token.icon;
  }

  return (
    TOKEN_ICON_MAP[token.symbol] ??
    TOKEN_ICON_MAP[token.symbol.toUpperCase()] ??
    token.icon ??
    FALLBACK_TOKEN_ICON
  );
}

export function displayDepositSymbol(symbol: string): string {
  return symbol === "WETH" ? "ETH" : symbol;
}
