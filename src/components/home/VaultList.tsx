import type { JSX } from "react";
import type { VaultInfo } from "~/types";
import { SUPPORTED_VAULTS, VAULT_DISPLAY_ORDER } from "~/constants";
import LegalFooter from "~/components/layout/LegalFooter";
import VaultCard from "./VaultCard";

interface VaultListProps {
  vaultsData: Record<
    string,
    { estimatedApy: string; totalValueLocked: string }
  > | null;
  vaultsLoading?: boolean;
  onSelectVault: (vault: VaultInfo) => void;
}

export default function VaultList({
  vaultsData,
  vaultsLoading = false,
  onSelectVault,
}: VaultListProps): JSX.Element {
  const orderedVaults = VAULT_DISPLAY_ORDER.map((symbol) =>
    SUPPORTED_VAULTS.find((v) => v.symbol === symbol),
  ).filter(Boolean) as VaultInfo[];

  return (
    <>
      <section className="product-list" aria-label="DeFi products">
        {orderedVaults.map((vault) => {
          const data = vaultsData?.[vault.id];
          const apy = data
            ? `${parseFloat(data.estimatedApy).toFixed(2)}%`
            : null;

          return (
            <VaultCard
              key={vault.symbol}
              vault={vault}
              apy={apy}
              isLoadingApy={vaultsLoading && !data}
              onEarn={() => onSelectVault(vault)}
            />
          );
        })}
      </section>
      <LegalFooter />
    </>
  );
}
