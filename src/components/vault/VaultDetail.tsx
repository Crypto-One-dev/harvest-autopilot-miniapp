import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { HarvestVaultData, TokenInfo, VaultInfo } from "~/types";
import { VAULT_DISPLAY } from "~/constants";
import { formatTVL } from "~/utilities/parsers";
import { fetchAPYData } from "~/utilities/chartApiCalls";
import { base } from "viem/chains";
import {
  ArrowLeftIcon,
  BaseLogoIcon,
  LoadingSpinner,
} from "~/components/icons";
import HoldingsPanel from "./HoldingsPanel";
import MyPositionsPanel from "./MyPositionsPanel";
import PerformancePanel, { averageApyForPeriod } from "./PerformancePanel";

export type VaultTab = "enter" | "exit" | "positions" | "details";

interface VaultDetailProps {
  vault: VaultInfo;
  vaultsData: Record<string, HarvestVaultData> | null;
  vaultsLoading?: boolean;
  activeTab: VaultTab;
  onTabChange: (tab: VaultTab) => void;
  onBack: () => void;
  chainId: number;
  selectedToken: TokenInfo;
  depositAmount: string;
  withdrawShareAmount: string;
  amountRawUnits?: string | null;
  vaultBalance: TokenInfo | null;
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  onTokenSelect: () => void;
  onAmountChange: (amount: string) => void;
  onMaxAmount: () => void | Promise<void>;
  onConnect: () => void;
  onNotify: (message: string, type?: "error" | "success") => void;
  onSuccess: () => void | Promise<void>;
  onRefreshBalances?: () => void | Promise<void>;
  onSyncAmountToLiveMax?: (raw: string, display: string) => void;
}

const TABS: { id: VaultTab; label: string }[] = [
  { id: "enter", label: "Enter" },
  { id: "exit", label: "Exit" },
  { id: "positions", label: "My Position" },
  { id: "details", label: "Details" },
];

export default function VaultDetail({
  vault,
  vaultsData,
  vaultsLoading = false,
  activeTab,
  onTabChange,
  onBack,
  chainId,
  selectedToken,
  depositAmount,
  withdrawShareAmount,
  amountRawUnits = null,
  vaultBalance,
  walletAddress,
  isConnected,
  isConnecting,
  onTokenSelect,
  onAmountChange,
  onMaxAmount,
  onConnect,
  onNotify,
  onSuccess,
  onRefreshBalances,
  onSyncAmountToLiveMax,
}: VaultDetailProps): JSX.Element {
  const data = vaultsData?.[vault.id];
  const apy = data ? `${parseFloat(data.estimatedApy).toFixed(2)}%` : null;
  const tvl = data ? formatTVL(data.totalValueLocked) : null;
  const display = VAULT_DISPLAY[vault.symbol];

  const [apy24h, setApy24h] = useState<string | null>(apy);
  const [apy7d, setApy7d] = useState<string | null>(apy);
  const [apyStatsLoading, setApyStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadApyStats() {
      setApyStatsLoading(true);
      try {
        const apyData = await fetchAPYData(vault.vaultAddress, "30d", base.id);
        if (cancelled) return;

        const avg24h = averageApyForPeriod(apyData, 1);
        const avg7d = averageApyForPeriod(apyData, 7);

        setApy24h(avg24h !== null ? `${avg24h.toFixed(2)}%` : apy);
        setApy7d(avg7d !== null ? `${avg7d.toFixed(2)}%` : apy);
      } catch {
        setApy24h(apy);
        setApy7d(apy);
      } finally {
        if (!cancelled) setApyStatsLoading(false);
      }
    }

    loadApyStats();
    return () => {
      cancelled = true;
    };
  }, [vault.vaultAddress, apy]);

  return (
    <>
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeftIcon />
        All vaults
      </button>

      <section className="product-recap">
        <img
          src={vault.icon}
          alt={vault.symbol}
          width={46}
          height={46}
          className="recap-icon"
        />
        <div className="recap-text">
          <h1 className="recap-name">
            {display?.title ?? `${vault.symbol} Autopilot`}
          </h1>
          <p className="recap-tagline">
            <span className="base-chip" aria-hidden="true">
              <BaseLogoIcon />
            </span>
            {display?.subtitle ?? ""}
          </p>
        </div>
        <div className="recap-apy">
          <span className="recap-apy-value">
            {vaultsLoading && !data ? (
              <LoadingSpinner size={22} />
            ) : (
              (apy ?? "—")
            )}
          </span>
          <span className="recap-apy-label">Live APY</span>
        </div>
      </section>

      <div className="tabs">
        <div
          className="tabbar tabbar-4"
          role="tablist"
          aria-label="Product views"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab${activeTab === tab.id ? " is-active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "enter" && (
          <HoldingsPanel
            mode="deposit"
            chainId={chainId}
            vault={vault}
            selectedToken={selectedToken}
            depositAmount={depositAmount}
            withdrawShareAmount={withdrawShareAmount}
            amountRawUnits={amountRawUnits}
            vaultBalance={vaultBalance}
            vaultsData={vaultsData}
            estimatedApy={data?.estimatedApy ?? null}
            walletAddress={walletAddress}
            isConnected={isConnected}
            isConnecting={isConnecting}
            onTokenSelect={onTokenSelect}
            onAmountChange={onAmountChange}
            onMaxAmount={onMaxAmount}
            onConnect={onConnect}
            onNotify={onNotify}
            onSuccess={onSuccess}
            onRefreshBalances={onRefreshBalances}
            onSyncAmountToLiveMax={onSyncAmountToLiveMax}
          />
        )}

        {activeTab === "exit" && (
          <HoldingsPanel
            mode="withdraw"
            chainId={chainId}
            vault={vault}
            selectedToken={selectedToken}
            depositAmount={depositAmount}
            withdrawShareAmount={withdrawShareAmount}
            amountRawUnits={amountRawUnits}
            vaultBalance={vaultBalance}
            vaultsData={vaultsData}
            walletAddress={walletAddress}
            isConnected={isConnected}
            isConnecting={isConnecting}
            onTokenSelect={onTokenSelect}
            onAmountChange={onAmountChange}
            onMaxAmount={onMaxAmount}
            onConnect={onConnect}
            onNotify={onNotify}
            onSuccess={onSuccess}
            onRefreshBalances={onRefreshBalances}
            onSyncAmountToLiveMax={onSyncAmountToLiveMax}
          />
        )}

        {activeTab === "positions" && (
          <MyPositionsPanel
            vault={vault}
            vaultBalance={vaultBalance}
            walletAddress={walletAddress}
            isConnected={isConnected}
            vaultsData={vaultsData}
          />
        )}

        {activeTab === "details" && (
          <PerformancePanel
            vault={vault}
            apy24h={apy24h}
            apy7d={apy7d}
            tvl={tvl}
            allocPointData={data?.allocPointData}
            apyStatsLoading={apyStatsLoading}
            vaultsLoading={vaultsLoading}
          />
        )}
      </div>
    </>
  );
}
