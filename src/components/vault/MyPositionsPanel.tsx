import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { base } from "viem/chains";
import type {
  ChartDataPoint,
  HarvestVaultData,
  TokenInfo,
  VaultInfo,
} from "~/types";
import { formatBalance } from "~/utilities/parsers";
import { getTokenIconPath } from "~/utilities/tokenIcons";
import {
  fetchUserBalanceData,
  getIPORVaultHistories,
} from "~/utilities/chartApiCalls";
import PositionBalanceChart from "./PositionBalanceChart";
import { LoadingSpinner } from "~/components/icons";

interface MyPositionsPanelProps {
  vault: VaultInfo;
  vaultBalance: TokenInfo | null;
  walletAddress: string | null;
  isConnected: boolean;
  vaultsData?: Record<string, HarvestVaultData> | null;
}

function findClosestByTimestamp<T extends { timestamp: string | number }>(
  data: T[],
  targetSec: number,
): T {
  return data.reduce((prev, curr) =>
    Math.abs(Number(curr.timestamp) - targetSec) <
    Math.abs(Number(prev.timestamp) - targetSec)
      ? curr
      : prev,
  );
}

function getSharePriceFromVaultData(
  vaultData: HarvestVaultData | null | undefined,
  underlyingDecimals: number,
): number {
  if (vaultData?.pricePerFullShare) {
    const decimals = vaultData.decimals ?? underlyingDecimals;
    return parseFloat(vaultData.pricePerFullShare) / Math.pow(10, decimals);
  }
  return 1;
}

function getSharePriceFromHistory(
  vaultHistory: { timestamp: string | number; sharePrice?: string }[],
  timestampMs: number,
  underlyingDecimals: number,
  fallback: number,
): number {
  if (vaultHistory.length === 0) return fallback;

  const timestampSec =
    timestampMs < 1e12 ? timestampMs : Math.floor(timestampMs / 1000);
  const closest = findClosestByTimestamp(vaultHistory, timestampSec);
  const price =
    parseFloat(closest.sharePrice || "0") / Math.pow(10, underlyingDecimals);

  return price > 0 ? price : fallback;
}

/** USD price of one underlying token (USDC ≈ 1, WETH ≈ market price). */
function getUnderlyingUsdPrice(
  vaultData: HarvestVaultData | null | undefined,
): number {
  if (vaultData?.usdPrice) {
    const price = parseFloat(vaultData.usdPrice);
    if (price > 0) return price;
  }
  return 1;
}

function sharesToUnderlying(shares: number, sharePrice: number): number {
  return shares * sharePrice;
}

function convertBalanceHistoryToUnderlying(
  balanceHistory: ChartDataPoint[],
  vaultHistory: { timestamp: string | number; sharePrice?: string }[],
  underlyingDecimals: number,
  fallbackSharePrice: number,
): ChartDataPoint[] {
  return balanceHistory.map((point) => {
    const sharePrice = getSharePriceFromHistory(
      vaultHistory,
      point.timestamp,
      underlyingDecimals,
      fallbackSharePrice,
    );

    return {
      timestamp: point.timestamp,
      value: point.value * sharePrice,
    };
  });
}

function buildChartSeries(
  history: ChartDataPoint[],
  currentUnderlying: number,
): ChartDataPoint[] {
  const sorted = [...history]
    .filter((point) => point.value >= 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length === 0 && currentUnderlying > 0) {
    return [{ timestamp: Date.now(), value: currentUnderlying }];
  }

  if (sorted.length === 0) {
    return [];
  }

  const latest = sorted[sorted.length - 1];
  if (Math.abs(latest.value - currentUnderlying) > 1e-9) {
    return [...sorted, { timestamp: Date.now(), value: currentUnderlying }];
  }

  return sorted;
}

function computeLifetimeEarned(
  chartSeries: ChartDataPoint[],
  underlyingUsdPrice: number,
): { amount: number; usd: number } | null {
  if (chartSeries.length < 2) return null;

  const first =
    chartSeries.find((point) => point.value > 0)?.value ?? chartSeries[0].value;
  const peak = Math.max(...chartSeries.map((point) => point.value));
  const amount = Math.max(0, peak - first);

  if (!Number.isFinite(amount) || amount < 1e-12) {
    return { amount: 0, usd: 0 };
  }

  return {
    amount,
    usd: amount * underlyingUsdPrice,
  };
}

export default function MyPositionsPanel({
  vault,
  vaultBalance,
  walletAddress,
  isConnected,
  vaultsData,
}: MyPositionsPanelProps): JSX.Element {
  const [balanceHistory, setBalanceHistory] = useState<ChartDataPoint[]>([]);
  const [vaultHistory, setVaultHistory] = useState<
    { timestamp: string | number; sharePrice?: string }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const vaultData = vaultsData?.[vault.id] ?? null;
  const shareBalance = parseFloat(vaultBalance?.balance ?? "0");
  const sharePrice = getSharePriceFromVaultData(vaultData, vault.decimals);
  const underlyingUsdPrice = getUnderlyingUsdPrice(vaultData);

  const currentUnderlying = useMemo(() => {
    if (Number(vaultBalance?.balanceUSD) > 0 && underlyingUsdPrice > 0) {
      return parseFloat(vaultBalance!.balanceUSD) / underlyingUsdPrice;
    }
    return sharesToUnderlying(shareBalance, sharePrice);
  }, [vaultBalance, underlyingUsdPrice, shareBalance, sharePrice]);

  const tokenSymbol = vault.symbol;

  useEffect(() => {
    if (!walletAddress || !isConnected) {
      setBalanceHistory([]);
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      if (!walletAddress) return;

      setHistoryLoading(true);
      try {
        const [balanceResult, vaultHistoryResult] = await Promise.all([
          fetchUserBalanceData(
            vault.vaultAddress,
            walletAddress,
            "365d",
            base.id,
            vault.vaultDecimals,
          ),
          getIPORVaultHistories(base.id, vault.vaultAddress),
        ]);
        if (!cancelled) {
          setBalanceHistory(balanceResult.balance);
          setVaultHistory(vaultHistoryResult.vaultHIPORData ?? []);
        }
      } catch {
        if (!cancelled) {
          setBalanceHistory([]);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, isConnected, vault.vaultAddress, vault.vaultDecimals]);

  const initialSharePrice = useMemo(() => {
    const firstPoint = balanceHistory.find((point) => point.value > 0);
    if (!firstPoint) return sharePrice;

    return getSharePriceFromHistory(
      vaultHistory,
      firstPoint.timestamp,
      vault.decimals,
      sharePrice,
    );
  }, [balanceHistory, vaultHistory, vault.decimals, sharePrice]);

  const underlyingHistory = useMemo(
    () =>
      convertBalanceHistoryToUnderlying(
        balanceHistory,
        vaultHistory,
        vault.decimals,
        sharePrice,
      ),
    [balanceHistory, vaultHistory, vault.decimals, sharePrice],
  );

  const chartData = useMemo(
    () => buildChartSeries(underlyingHistory, currentUnderlying),
    [underlyingHistory, currentUnderlying],
  );

  const earned = useMemo(() => {
    if (balanceHistory.length === 0) return null;

    if (shareBalance > 0) {
      const amount = shareBalance * (sharePrice - initialSharePrice);

      if (!Number.isFinite(amount) || Math.abs(amount) < 1e-12) {
        return { amount: 0, usd: 0 };
      }

      return {
        amount,
        usd: amount * underlyingUsdPrice,
      };
    }

    return computeLifetimeEarned(chartData, underlyingUsdPrice);
  }, [
    shareBalance,
    sharePrice,
    initialSharePrice,
    balanceHistory.length,
    underlyingUsdPrice,
    chartData,
  ]);

  const hasPosition = shareBalance > 0;
  const hasHistory = balanceHistory.some((point) => point.value > 0);

  if (!isConnected) {
    return (
      <div className="panel">
        <p className="panel-note">Connect a wallet to view your position.</p>
      </div>
    );
  }

  if (!hasPosition && !hasHistory && !historyLoading) {
    return (
      <div className="panel">
        <p className="panel-note">
          You don&apos;t have a position in this vault yet. Use the Enter tab to
          deposit.
        </p>
      </div>
    );
  }

  const balance = formatBalance(currentUnderlying.toString());
  const balanceUsd = hasPosition
    ? Number(vaultBalance?.balanceUSD) > 0
      ? `≈ $${formatBalance(vaultBalance!.balanceUSD)}`
      : currentUnderlying > 0
        ? `≈ $${formatBalance((currentUnderlying * underlyingUsdPrice).toString())}`
        : ""
    : "";

  const earnedAmount =
    earned === null
      ? null
      : `${earned.amount >= 0 ? "+" : ""}${formatBalance(earned.amount.toString())}`;
  const earnedUsd =
    earned === null || Math.abs(earned.amount) < 1e-12
      ? ""
      : `≈ $${formatBalance(Math.abs(earned.usd).toString())}`;

  return (
    <div className="panel">
      <div className="position-panel">
        <div className="position-grid">
          <div className="position-box">
            <span className="position-ico" aria-hidden="true">
              <img
                src={getTokenIconPath(vault)}
                alt={vault.symbol}
                width={20}
                height={20}
                className="token-art"
              />
            </span>
            <span className="position-label">My Balance</span>
            <span className="position-value">
              {hasPosition ? `${balance} ${tokenSymbol}` : `0 ${tokenSymbol}`}
            </span>
            {balanceUsd && <span className="position-usd">{balanceUsd}</span>}
            {!hasPosition && hasHistory && (
              <span className="position-usd">Position closed</span>
            )}
          </div>

          <div className="position-box">
            <span className="position-ico" aria-hidden="true">
              <img
                src={getTokenIconPath(vault)}
                alt={vault.symbol}
                width={20}
                height={20}
                className="token-art"
              />
            </span>
            <span className="position-label">Total earned</span>
            {earnedAmount === null ? (
              <>
                <span className="position-value is-earn">
                  {historyLoading ? (
                    <LoadingSpinner size={18} className="position-earn-spinner" />
                  ) : (
                    "—"
                  )}
                </span>
                <span className="position-usd">
                  {historyLoading ? "Loading earnings…" : "Need more history"}
                </span>
              </>
            ) : (
              <>
                <span className="position-value is-earn">
                  {earnedAmount} {tokenSymbol}
                </span>
                {earnedUsd && <span className="position-usd">{earnedUsd}</span>}
              </>
            )}
          </div>
        </div>

        <PositionBalanceChart
          data={chartData}
          tokenSymbol={tokenSymbol}
          loading={historyLoading}
        />
      </div>
    </div>
  );
}
