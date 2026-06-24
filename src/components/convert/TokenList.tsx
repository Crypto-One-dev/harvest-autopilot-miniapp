import type { JSX } from "react";
import type { TokenInfo } from "~/types";
import { formatBalance } from "~/utilities/parsers";
import { getTokenIconPath } from "~/utilities/tokenIcons";
import { FALLBACK_TOKEN_ICON } from "~/constants";

interface TokenListProps {
  tokens: TokenInfo[];
  onSelect: (token: TokenInfo) => void;
  selectedToken?: TokenInfo;
}

export default function TokenList({
  tokens,
  onSelect,
  selectedToken,
}: TokenListProps): JSX.Element {
  return (
    <div className="token-list">
      {tokens.map((token) => {
        const isSelected =
          selectedToken?.address?.toLowerCase() ===
            token.address?.toLowerCase() ||
          selectedToken?.symbol === token.symbol;

        return (
          <button
            key={token.id || token.address || token.symbol}
            type="button"
            onClick={() => onSelect(token)}
            className={`token-list-item${isSelected ? " is-selected" : ""}`}
          >
            <div className="token-list-left">
              <img
                src={getTokenIconPath(token)}
                alt={token.symbol}
                width={32}
                height={32}
                className="token-list-icon"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = FALLBACK_TOKEN_ICON;
                }}
              />
              <span className="token-list-symbol">{token.symbol}</span>
            </div>
            {token.balance !== undefined && (
              <div className="token-list-right">
                <span className="token-list-balance">
                  {formatBalance(token.balance)}
                </span>
                {token.balanceUSD !== undefined && (
                  <span className="token-list-usd">
                    ${Number(token.balanceUSD).toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
