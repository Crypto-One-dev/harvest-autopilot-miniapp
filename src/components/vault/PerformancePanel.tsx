import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { AllocPointData, VaultInfo } from "~/types";
import { fetchMergedPerformanceChartData } from "~/utilities/chartApiCalls";
import {
  getBaseExplorerAddressUrl,
  parseAllocationData,
} from "~/utilities/allocation";
import { base } from "viem/chains";
import { ExternalLinkIcon, LoadingSpinner } from "~/components/icons";
import AllocationBox from "./AllocationBox";
import PerformanceChart from "./PerformanceChart";

interface PerformancePanelProps {
  vault: VaultInfo;
  apy24h: string | null;
  apy7d: string | null;
  tvl: string | null;
  allocPointData?: AllocPointData[];
  apyStatsLoading?: boolean;
  vaultsLoading?: boolean;
}

function StatValue({
  value,
  loading,
}: {
  value: string | null;
  loading?: boolean;
}): ReactNode {
  if (loading && !value) {
    return <LoadingSpinner size={18} />;
  }

  return value ?? "—";
}

function averageApyForPeriod(
  data: { timestamp: number; value: number }[],
  days: number,
): number | null {
  if (!data.length) return null;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = data.filter((point) => point.timestamp >= cutoff);
  const points = filtered.length ? filtered : data.slice(-1);
  const sum = points.reduce((acc, point) => acc + point.value, 0);
  return sum / points.length;
}

export default function PerformancePanel({
  vault,
  apy24h,
  apy7d,
  tvl,
  allocPointData,
  apyStatsLoading = false,
  vaultsLoading = false,
}: PerformancePanelProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<
    { timestamp: number; sharePrice: number; apy: number; tvl: number }[]
  >([]);

  const allocations = parseAllocationData(allocPointData);

  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      setLoading(true);
      try {
        const merged = await fetchMergedPerformanceChartData(
          vault.vaultAddress,
          "30d",
          base.id,
          vault.decimals,
        );

        if (cancelled) return;
        setChartData(merged);
      } catch (err) {
        console.error("Failed to load performance chart:", err);
        setChartData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadChart();
    return () => {
      cancelled = true;
    };
  }, [vault.vaultAddress, vault.decimals]);

  const stats = [
    {
      label: "24h APY",
      value: apy24h,
      loading: apyStatsLoading,
    },
    {
      label: "7d APY",
      value: apy7d,
      loading: apyStatsLoading,
    },
    {
      label: "TVL",
      value: tvl,
      loading: vaultsLoading,
    },
  ];

  const displayName =
    vault.symbol === "WETH"
      ? "WETH Autopilot"
      : vault.symbol === "USDC"
        ? "USDC Autopilot"
        : "cbBTC Autopilot";

  return (
    <>
      <div className="panel">
        <div className="stat-row">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-tile">
              <span className="stat-label">{stat.label}</span>
              <span className="stat-value">
                <StatValue value={stat.value} loading={stat.loading} />
              </span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="chart-plot chart-plot-loading">
            <LoadingSpinner size={28} />
          </div>
        ) : chartData.length === 0 ? (
          <div className="chart-plot chart-plot-loading">
            <span style={{ color: "var(--ink-3)", fontSize: 13 }}>
              No chart data available
            </span>
          </div>
        ) : (
          <PerformanceChart data={chartData} />
        )}

        <p className="panel-note">
          Live from the Harvest API, refreshed every few minutes.
        </p>

        <div className="yield-source">
          <h2 className="block-title">Source of Yield</h2>
          <p className="block-text">
            Harvest {displayName} plugs into multiple sub-level vaults and uses
            algorithms to monitor and adjust positioning based on prevailing
            interest rates, liquidity conditions, and network gas costs. It
            streamlines the process by selecting optimal opportunities within
            Harvest, helping users maximize efficiency without manual oversight.
          </p>
          <a
            href={getBaseExplorerAddressUrl(vault.vaultAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-secondary vault-address-btn"
          >
            Vault address
            <ExternalLinkIcon />
          </a>
        </div>
      </div>

      <AllocationBox
        allocations={allocations}
        loading={vaultsLoading && allocations.length === 0}
      />
    </>
  );
}

export { averageApyForPeriod };
