import { useState } from "react";
import type { JSX } from "react";
import TokenList from "./TokenList";
import type { TokenInfo } from "../../types";

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: TokenInfo) => void;
  selectedToken?: TokenInfo;
  tokens: TokenInfo[];
}

export default function TokenSelectModal({
  isOpen,
  onClose,
  onSelect,
  selectedToken,
  tokens,
}: TokenSelectModalProps): JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="harvest-modal-overlay" onClick={onClose}>
      <div
        className="harvest-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-select-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="harvest-modal-header">
          <h2 id="token-select-title" className="harvest-modal-title">
            Select Token
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="harvest-modal-close"
            aria-label="Close token selection"
          >
            ✕
          </button>
        </div>

        <div className="form-field" style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search token name or symbol"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="token-search-input"
            aria-label="Search tokens"
          />
        </div>

        <div className="token-list-scroll">
          <TokenList
            tokens={filteredTokens}
            selectedToken={selectedToken}
            onSelect={(token: TokenInfo) => {
              onSelect(token);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
