import type { JSX } from "react";

import type { VaultInfo } from "~/types";

import { VAULT_DISPLAY } from "~/constants";

import { ArrowRightIcon, LoadingSpinner } from "~/components/icons";

interface VaultCardProps {
  vault: VaultInfo;

  apy: string | null;

  isLoadingApy?: boolean;

  onEarn: () => void;
}

export default function VaultCard({
  vault,

  apy,

  isLoadingApy = false,

  onEarn,
}: VaultCardProps): JSX.Element {
  const display = VAULT_DISPLAY[vault.symbol];

  return (
    <button
      type="button"
      className="product-card"
      aria-label={`Open ${display?.title ?? vault.symbol}`}
      onClick={onEarn}
    >
      <div className="product-top">
        <div className="apy">
          <span className="apy-value">
            {isLoadingApy ? <LoadingSpinner size={26} /> : (apy ?? "—")}
          </span>

          <span className="apy-label">Live APY</span>
        </div>

        <img
          src={vault.icon}
          alt={vault.symbol}
          width={40}
          height={40}
          className="product-icon token-art"
        />
      </div>

      <h2 className="product-name">
        {display?.title ?? `${vault.symbol} Autopilot`}
      </h2>

      <span className="cta-primary earn-cta">
        Earn now
        <ArrowRightIcon />
      </span>
    </button>
  );
}
