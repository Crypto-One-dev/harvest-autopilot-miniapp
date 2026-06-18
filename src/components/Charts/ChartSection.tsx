/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import TVLChart from "./TVLChart";
import APYChart from "./APYChart";
import SharePriceChart from "./SharePriceChart";
import UserBalanceChart from "./UserBalanceChart";
import { base } from "viem/chains";
import { SUPPORTED_VAULTS } from "~/constants";
import {
  fetchAllChartData,
  getIPORVaultHistories,
  getIPORUserBalanceHistories,
} from "~/utilities/chartApiCalls";
import {
  ChartSectionProps,
  CachedChartData,
  VaultHistoryData,
  UserBalanceHistoryData,
} from "~/types";

type ChartType = "balance" | "tvl" | "apy" | "sharePrice";
type RangeType = "1d" | "7d" | "30d" | "90d" | "365d" | "all";

export default function ChartSection({
  vaultAddress,
  walletAddress,
  vaultSymbol,
  isWalletConnected,
  chainId = base.id, // Use Base chain ID as default
}: ChartSectionProps) {
  const [selectedChart, setSelectedChart] = useState<ChartType>(
    isWalletConnected ? "balance" : "tvl",
  );
  const [range, setRange] = useState<RangeType>("30d");

  // Add a key to force re-rendering when vault changes
  const [vaultKey, setVaultKey] = useState<string>("");

  // Cache for chart data to avoid unnecessary API calls
  const [chartData, setChartData] = useState<CachedChartData>({
    period: range,
  });

  // Store vault history data to avoid multiple fetches
  const [vaultHistoryData, setVaultHistoryData] =
    useState<VaultHistoryData | null>(null);

  // Store user balance history data
  const [userBalanceHistoryData, setUserBalanceHistoryData] =
    useState<UserBalanceHistoryData | null>(null);

  // Track whether data is loading
  const [isLoading, setIsLoading] = useState(true);

  // Track data fetching states
  const [isVaultHistoryLoading, setIsVaultHistoryLoading] = useState(false);
  const [isUserBalanceHistoryLoading, setIsUserBalanceHistoryLoading] =
    useState(false);

  // Get vault info to access vaultDecimals
  const vaultInfo = SUPPORTED_VAULTS.find(
    (vault) => vault.vaultSymbol === vaultSymbol,
  );
  const vaultDecimals = vaultInfo?.vaultDecimals ?? 18; // Default to 18 if not found
  const tokenDecimals = vaultInfo?.decimals ?? 18; // Token decimals for share price
  const vaultId = vaultInfo?.id || ""; // Get vault ID for price data

  // Previous values for comparison
  const prevVaultAddress = useRef<string | null>(null);
  const prevWalletAddress = useRef<string | null>(null);
  const prevRange = useRef<string>(range);

  // Function to fetch vault history data
  const fetchVaultHistory = async (
    vaultAddr: string,
  ): Promise<VaultHistoryData> => {
    try {
      const result = await getIPORVaultHistories(chainId, vaultAddr);
      return result;
    } catch (error) {
      console.error("Error fetching vault history:", error);
      return { vaultHIPORData: [], vaultHIPORFlag: false };
    }
  };

  // Function to fetch user balance history data
  const fetchUserBalanceHistory = async (
    vaultAddr: string,
    userAddr: string,
  ): Promise<UserBalanceHistoryData> => {
    if (!userAddr) {
      return { balanceIPORData: [], balanceIPORFlag: false };
    }

    try {
      const result = await getIPORUserBalanceHistories(
        vaultAddr,
        chainId,
        userAddr,
      );
      return result;
    } catch (error) {
      console.error(
        `Error fetching user balance history for vault: ${vaultAddr}`,
        error,
      );
      return { balanceIPORData: [], balanceIPORFlag: false };
    }
  };

  // Effect to detect vault or wallet changes and update the key
  useEffect(() => {
    // Check if vault address changed
    const vaultChanged = vaultAddress !== prevVaultAddress.current;
    // Check if wallet address changed
    const walletChanged = walletAddress !== prevWalletAddress.current;

    if (vaultAddress && vaultChanged) {
      prevVaultAddress.current = vaultAddress;
      setVaultKey(vaultAddress); // Update the key to force re-fetch

      // Clear previous data when vault changes
      setVaultHistoryData(null);
      setUserBalanceHistoryData(null);

      // Clear chart data to prevent displaying old data
      setChartData({
        tvl: undefined,
        apy: undefined,
        sharePrice: undefined,
        userBalance: undefined,
        period: range,
      });

      // Reset loading state
      setIsLoading(true);
    }

    // If wallet changed but vault didn't, we only need to clear user balance data
    if (walletChanged && !vaultChanged && walletAddress) {
      prevWalletAddress.current = walletAddress;

      // Only clear user balance data when wallet changes
      setUserBalanceHistoryData(null);

      // Update chart data to clear user balance
      setChartData((prev) => ({
        ...prev,
        userBalance: undefined,
      }));

      // If currently showing balance chart, set loading
      if (selectedChart === "balance") {
        setIsLoading(true);
      }
    }
  }, [vaultAddress, walletAddress, range, selectedChart]);

  // Separate useEffect for fetching vault history
  useEffect(() => {
    if (!vaultAddress) return;

    // Only fetch if we don't have data yet
    if (!vaultHistoryData) {
      setIsVaultHistoryLoading(true);

      fetchVaultHistory(vaultAddress).then((result) => {
        setVaultHistoryData(result);
        setIsVaultHistoryLoading(false);
      });
    }
  }, [vaultAddress, vaultKey]);

  // Separate useEffect for fetching user balance history
  useEffect(() => {
    if (!vaultAddress || !walletAddress || !isWalletConnected) {
      setUserBalanceHistoryData(null);
      return;
    }

    const walletChanged = walletAddress !== prevWalletAddress.current;
    const vaultChanged = vaultAddress !== prevVaultAddress.current;
    const needsRefresh =
      walletChanged || vaultChanged || !userBalanceHistoryData;

    // Update refs to current values
    prevWalletAddress.current = walletAddress;

    // Only fetch if we need to refresh the data
    if (needsRefresh) {
      setIsUserBalanceHistoryLoading(true);

      fetchUserBalanceHistory(vaultAddress, walletAddress).then((result) => {
        // Only update if this is still the current vault and wallet
        if (
          vaultAddress === prevVaultAddress.current &&
          walletAddress === prevWalletAddress.current
        ) {
          setUserBalanceHistoryData(result);
        }
        setIsUserBalanceHistoryLoading(false);
      });
    }
  }, [vaultAddress, walletAddress, isWalletConnected, vaultKey]);

  // useEffect for loading chart data using the fetched histories
  useEffect(() => {
    // Skip if no vault address or if histories are still loading
    if (
      !vaultAddress ||
      isVaultHistoryLoading ||
      (isWalletConnected && walletAddress && isUserBalanceHistoryLoading)
    ) {
      return;
    }

    // Update range ref
    prevRange.current = range;

    // If only the range changed, we can reuse the existing data
    if (chartData.period !== range && vaultHistoryData) {
      loadAllChartData(vaultHistoryData, userBalanceHistoryData);
      return;
    }

    setIsLoading(true);

    // Use the fetched histories to load chart data
    if (vaultHistoryData) {
      loadAllChartData(vaultHistoryData, userBalanceHistoryData);
    }
  }, [
    vaultAddress,
    walletAddress,
    range,
    isWalletConnected,
    vaultHistoryData,
    userBalanceHistoryData,
    isVaultHistoryLoading,
    isUserBalanceHistoryLoading,
  ]);

  // Load all chart data at once using fetchAllChartData
  const loadAllChartData = async (
    historyData: VaultHistoryData,
    userBalanceHistory: UserBalanceHistoryData | null,
  ) => {
    if (!vaultAddress) return;

    try {
      const allData = await fetchAllChartData(
        vaultAddress,
        walletAddress || undefined,
        range,
        chainId,
        vaultDecimals,
        tokenDecimals,
        historyData.vaultHIPORData,
        historyData.vaultHIPORFlag,
        userBalanceHistory?.balanceIPORData,
        userBalanceHistory?.balanceIPORFlag,
      );

      // Update all chart data at once
      setChartData({
        tvl: allData.tvl,
        apy: allData.apy,
        sharePrice: allData.sharePrice,
        userBalance: allData.userBalance,
        period: range,
      });
    } catch (error) {
      console.error("Error loading all chart data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle chart type change - now just switches the display
  const handleChartTypeChange = (chartType: ChartType) => {
    // If trying to select balance but not connected, don't change
    if (chartType === "balance" && !isWalletConnected) {
      return;
    }

    setSelectedChart(chartType);
  };

  // Update selected chart when wallet connection changes
  useEffect(() => {
    if (!isWalletConnected && selectedChart === "balance") {
      // If wallet disconnected and showing balance, switch to TVL
      setSelectedChart("tvl");
    }
    // We don't automatically switch to balance when wallet is connected
    // to avoid unexpected chart changes - let the user choose
  }, [isWalletConnected, selectedChart]);

  // Map range value to display name
  const getRangeLabel = (rangeValue: RangeType): string => {
    switch (rangeValue) {
      case "1d":
        return "1D";
      case "7d":
        return "1W";
      case "30d":
        return "1M";
      case "90d":
        return "3M";
      case "365d":
        return "1Y";
      case "all":
        return "All";
      default:
        return "1M";
    }
  };

  // Available ranges
  const ranges: RangeType[] = ["1d", "7d", "30d", "90d", "365d", "all"];

  // Chart types to display
  const chartTypes = [
    { value: "balance", label: "Balance", showWhenConnected: true },
    { value: "tvl", label: "TVL", showWhenConnected: true },
    { value: "apy", label: "APY", showWhenConnected: true },
    { value: "sharePrice", label: "Share Price", showWhenConnected: true },
  ];

  // Filter chart types based on wallet connection
  const availableChartTypes = chartTypes.filter(
    (chart) => chart.value !== "balance" || isWalletConnected,
  );

  return (
    <div className="mt-6">
      <div className="flex flex-col mb-3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            Analytics
          </h2>

          {/* Chart type selector */}
          <div className="flex space-x-2">
            {availableChartTypes.map((chart) => (
              <button
                key={chart.value}
                onClick={() => handleChartTypeChange(chart.value as ChartType)}
                className={`px-2 py-0.5 rounded-md text-xs ${
                  selectedChart === chart.value
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {chart.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period selector */}
        <div className="flex space-x-2 self-end mb-2">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 rounded-md text-xs ${
                range === r
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              {getRangeLabel(r)}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Chart */}
      <div className="w-full">
        {/* Only show the Balance chart if it's selected AND wallet is connected */}
        {selectedChart === "balance" && isWalletConnected && walletAddress && (
          <UserBalanceChart
            key={`balance-${vaultAddress}-${walletAddress}-${range}`}
            vaultAddress={vaultAddress}
            userAddress={walletAddress}
            period={range}
            chainId={chainId}
            height={350}
            vaultDecimals={vaultDecimals}
            vaultId={vaultId}
            cachedData={chartData.userBalance}
            isLoading={isLoading}
          />
        )}

        {/* Only show the TVL chart if it's selected */}
        {selectedChart === "tvl" && (
          <TVLChart
            key={`tvl-${vaultAddress}-${range}`}
            vaultAddress={vaultAddress}
            period={range}
            chainId={chainId}
            height={350}
            cachedData={chartData.tvl}
            isLoading={isLoading}
          />
        )}

        {/* Only show the APY chart if it's selected */}
        {selectedChart === "apy" && (
          <APYChart
            key={`apy-${vaultAddress}-${range}`}
            vaultAddress={vaultAddress}
            period={range}
            chainId={chainId}
            height={350}
            cachedData={chartData.apy}
            isLoading={isLoading}
          />
        )}

        {/* Only show the Share Price chart if it's selected */}
        {selectedChart === "sharePrice" && (
          <SharePriceChart
            key={`sharePrice-${vaultAddress}-${range}`}
            vaultAddress={vaultAddress}
            period={range}
            chainId={chainId}
            height={350}
            cachedData={chartData.sharePrice}
            isLoading={isLoading}
            tokenDecimals={tokenDecimals}
          />
        )}
      </div>
    </div>
  );
}
