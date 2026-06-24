import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
} from "recharts";
import { fetchUserBalanceData } from "~/utilities/chartApiCalls";
import { ChartDataPoint, UserBalanceChartProps } from "~/types";
import { formatBalance } from "~/utilities/parsers";
import { useVaultsData } from "~/hooks/useVaultsData";

export default function UserBalanceChart({
  vaultAddress,
  userAddress,
  period = "30d",
  height = 250,
  chainId = 8453, // Default to Base chain
  vaultDecimals = 18, // Default vault decimals
  vaultId = "", // Vault ID for fetching price data
  cachedData,
  isLoading: externalLoading = false,
}: UserBalanceChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>(cachedData?.balance || []);
  const [loading, setLoading] = useState<boolean>(
    externalLoading || !cachedData,
  );
  const [isDataReady, setIsDataReady] = useState<"true" | "false" | "loading">(
    cachedData ? "true" : "loading",
  );
  const [curDate, setCurDate] = useState<string>("");
  const [curTokenValue, setCurTokenValue] = useState<string>("");
  const [curUsdValue, setCurUsdValue] = useState<string>("");

  // Get vault data from API
  const { vaultsData } = useVaultsData();

  // Get current vault data
  const currentVaultData = useMemo(() => {
    if (vaultsData && vaultId) {
      const result = vaultsData[vaultId] || null;
      return result;
    }
    return null;
  }, [vaultsData, vaultId]);

  // Extract current token price
  const tokenPrice = useMemo(() => {
    if (currentVaultData && currentVaultData.usdPrice) {
      return parseFloat(currentVaultData.usdPrice);
    }
    // Fallback: Calculate from TVL and share price if available
    if (
      currentVaultData &&
      currentVaultData.totalValueLocked &&
      currentVaultData.sharePrice
    ) {
      const tvl = parseFloat(currentVaultData.totalValueLocked);
      const sharePrice = parseFloat(currentVaultData.sharePrice);
      if (tvl > 0 && sharePrice > 0) {
        return sharePrice;
      }
    }
    return 1; // Default fallback price
  }, [currentVaultData]);

  // Extract share price from vault data
  const sharePrice = useMemo(() => {
    if (currentVaultData && currentVaultData.pricePerFullShare) {
      const pricePerFullShare = parseFloat(currentVaultData.pricePerFullShare);
      // Use decimals from vault data if available, otherwise use vaultDecimals prop
      const decimals = currentVaultData.decimals ?? vaultDecimals;
      // Divide pricePerFullShare by 10^decimals to get the actual share price
      return pricePerFullShare / Math.pow(10, decimals);
    }
    return 1; // Default fallback share price
  }, [currentVaultData, vaultDecimals]);

  useEffect(() => {
    // Reset data when vault address changes
    if (vaultAddress) {
      // Clear current data while loading new data
      if (!cachedData) {
        setData([]);
        setIsDataReady("loading");
        setLoading(true);
      }
    }

    // If we have cached data and external loading is false, use cached data
    if (cachedData && !externalLoading) {
      setData(cachedData.balance || []);
      setLoading(false);
      setIsDataReady(cachedData.balance?.length > 0 ? "true" : "false");

      // Set date and content with latest value
      if (cachedData.balance?.length > 0) {
        const latestData = cachedData.balance[cachedData.balance.length - 1];
        const latestUsdValue = latestData.value * tokenPrice * sharePrice;

        setCurDate(new Date(latestData.timestamp).toLocaleDateString());
        setCurTokenValue(formatBalance(latestData.value.toString()));
        setCurUsdValue(`$${Number(latestUsdValue).toFixed(2)}`);
      }
      return;
    }

    // Update loading state from external prop
    setLoading(externalLoading);

    // Skip fetching if we're using external loading control
    if (externalLoading) {
      return;
    }

    const fetchData = async () => {
      if (!vaultAddress || !userAddress) {
        setIsDataReady("false");
        return;
      }

      setLoading(true);
      setIsDataReady("loading");

      try {
        const balanceData = await fetchUserBalanceData(
          vaultAddress,
          userAddress,
          period,
          chainId,
          vaultDecimals,
        );

        // Check if we have valid data
        if (balanceData.balance.length === 0) {
          setData([]);
          setIsDataReady("false");
        } else {
          setData(balanceData.balance);
          setIsDataReady("true");

          // Set date and content with latest value
          if (balanceData.balance.length > 0) {
            const latestData =
              balanceData.balance[balanceData.balance.length - 1];
            const latestUsdValue = latestData.value * tokenPrice * sharePrice;

            setCurDate(new Date(latestData.timestamp).toLocaleDateString());
            setCurTokenValue(formatBalance(latestData.value.toString()));
            setCurUsdValue(`$${Number(latestUsdValue).toFixed(2)}`);
          }
        }
      } catch (err) {
        console.error("Error fetching user balance data:", err);
        setIsDataReady("false");
      } finally {
        setLoading(false);
      }
    };

    // Only fetch data if no cached data is provided
    if (!cachedData) {
      fetchData();
    }
  }, [
    vaultAddress,
    userAddress,
    period,
    chainId,
    vaultDecimals,
    tokenPrice,
    sharePrice,
    cachedData,
    externalLoading,
  ]);

  // Custom tooltip component to avoid setState during render
  const CustomTooltip = ({
    active,
    payload,
    label,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }: any) => {
    if (active && payload && payload.length > 0) {
      const date = new Date(label);
      const formattedDate = date.toLocaleDateString();

      return (
        <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-sm">
          <p className="text-xs text-gray-500 mb-1">{formattedDate}</p>
          <p className="text-xs font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
            {curTokenValue}
          </p>
          <p className="text-xs font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1"></span>
            {curUsdValue}
          </p>
        </div>
      );
    }

    return null;
  };

  // Handle mouse events from the chart
  const handleMouseMove = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chartState: any,
  ) => {
    if (
      chartState &&
      chartState.activePayload &&
      chartState.activePayload.length > 0
    ) {
      const { activePayload, activeLabel } = chartState;
      const date = new Date(activeLabel);
      setCurDate(date.toLocaleDateString());

      // Get token value
      const tokenPayload = activePayload.find(
        (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          p: any,
        ) => p.dataKey === "tokenValue",
      );
      if (tokenPayload) {
        const tokenValue = tokenPayload.value;
        setCurTokenValue(formatBalance(tokenValue.toString()));

        // Calculate USD value using token price and share price
        const usdValue = tokenValue * tokenPrice * sharePrice;
        setCurUsdValue(`$${Number(usdValue).toFixed(2)}`);
      }
    }
  };

  // Handle mouse leave from the chart
  const handleMouseLeave = () => {
    if (data.length > 0) {
      const latestData = data[data.length - 1];
      setCurDate(new Date(latestData.timestamp).toLocaleDateString());
      setCurTokenValue(formatBalance(latestData.value.toString()));

      // Calculate USD value using token price and share price
      const usdValue = latestData.value * tokenPrice * sharePrice;
      setCurUsdValue(`$${Number(usdValue).toFixed(2)}`);
    }
  };

  // Custom X-axis tick renderer
  const renderCustomXAxisTick = ({
    x,
    y,
    payload,
    index,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }: any) => {
    let path = "";
    let dx = 0;

    if (payload.value !== "") {
      const date = new Date(payload.value);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      path = `${month}/${day}`;
    }

    if (index === 0) dx = 5; // Adjust the first tick

    return (
      <text
        orientation="bottom"
        x={x + dx}
        y={y + 4}
        width={24}
        height={24}
        textAnchor="middle"
        viewBox="0 0 1024 1024"
        fill="#888"
        fontSize="10px"
      >
        <tspan dy="0.71em">{path}</tspan>
      </text>
    );
  };

  // If we have no data, show a message
  if (isDataReady === "false" && !loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-medium">Your Balance</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[250px] bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-gray-500 dark:text-gray-400 text-center p-4">
            No balance history available for this period
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-medium">Your Balance</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[250px] bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-2"></div>
          <div className="text-gray-500 dark:text-gray-400">
            Loading chart data...
          </div>
        </div>
      </div>
    );
  }

  // Prepare data for chart
  const chartData = data.map((item) => {
    // Get the token value
    const tokenValue = item.value;

    // Calculate USD value using token price and share price
    const usdValue = tokenValue * tokenPrice * sharePrice;

    return {
      timestamp: item.timestamp,
      tokenValue: tokenValue,
      usdValue: usdValue,
    };
  });

  // Calculate min and max values for better scaling
  const maxTokenValue = Math.max(
    ...chartData.map((item) => item.tokenValue),
    0,
  );
  const tokenMin = 0;
  const tokenMax = maxTokenValue === 0 ? 1 : maxTokenValue * 1.1;

  const maxUsdValue = Math.max(...chartData.map((item) => item.usdValue), 0);
  const usdMin = 0;
  const usdMax = maxUsdValue === 0 ? 1 : maxUsdValue * 1.3;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-medium">Your Balance</h3>
      </div>

      <div className="flex flex-wrap mb-2 text-xs">
        <div className="mr-6">
          <span className="text-gray-500 dark:text-gray-400">{curDate}</span>
        </div>
        <div className="mr-6">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span>
          <span className="font-medium">{curTokenValue}</span>
        </div>
        <div>
          <span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-1"></span>
          <span className="font-medium">{curUsdValue}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D26B" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="0"
            strokeLinecap="butt"
            stroke="rgba(228, 228, 228, 0.2)"
            vertical={false}
          />

          <XAxis
            dataKey="timestamp"
            tickLine={false}
            tickCount={5}
            tick={renderCustomXAxisTick}
            padding={{ right: 2 }}
          />

          {/* Left Y-axis for token value */}
          <YAxis
            yAxisId="left"
            dataKey="tokenValue"
            tickLine={false}
            axisLine={false}
            tick={false}
            width={0}
            domain={[tokenMin, tokenMax]}
            tickFormatter={(value) => formatBalance(value.toString())}
            stroke="#00D26B"
            orientation="left"
          />

          {/* Right Y-axis for USD value */}
          <YAxis
            yAxisId="right"
            dataKey="usdValue"
            tickLine={false}
            axisLine={false}
            tick={false}
            width={0}
            domain={[usdMin, usdMax]}
            tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
            stroke="#A855F7"
            orientation="right"
            // Create a different scale to visually separate the lines
            scale="linear"
          />

          <Tooltip content={<CustomTooltip />} />

          {/* USD value line (showing USD line first, behind token line) */}
          <Line
            yAxisId="right"
            dataKey="usdValue"
            name="USD Value"
            type="monotone"
            strokeLinecap="round"
            strokeWidth={2.5}
            stroke="#A855F7"
            dot={false}
            activeDot={{ r: 5, stroke: "#A855F7", fill: "#A855F7" }}
            strokeDasharray="5 3"
            isAnimationActive={true}
          />

          {/* Token value line */}
          <Line
            yAxisId="left"
            dataKey="tokenValue"
            name="Token Balance"
            type="monotone"
            strokeLinecap="round"
            strokeWidth={3}
            stroke="#00D26B"
            dot={false}
            activeDot={{ r: 6, stroke: "#00D26B", fill: "#00D26B" }}
            isAnimationActive={true}
          />

          {/* Token value area */}
          <Area
            yAxisId="left"
            dataKey="tokenValue"
            type="monotone"
            stroke="#00D26B"
            strokeWidth={0}
            fillOpacity={0.1}
            fill="url(#tokenGradient)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
