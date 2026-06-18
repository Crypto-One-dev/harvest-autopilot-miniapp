/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import axios from "axios";
import { ChartDataPoint, UserBalanceChartData } from "~/types";

/**
 * Execute a GraphQL query through our proxy API to avoid CSP issues
 * @param url The original GraphQL endpoint (not used directly due to CSP)
 * @param query The GraphQL query
 * @param variables Query variables
 * @returns The query result data
 */
async function executeGraphCall(query: string, variables: any): Promise<any> {
  try {
    // Use our proxy API endpoint instead of direct GraphQL call
    const response = await axios.post("/api/subgraph", {
      query,
      variables,
    });

    if (response.data.errors) {
      throw new Error(`GraphQL Error: ${response.data.errors[0].message}`);
    }

    return response.data.data;
  } catch (error) {
    console.error("GraphQL query error:", error);
    throw error;
  }
}

/**
 * Fetches vault histories using GraphQL
 * @param chainId The chain ID (default: 8453 for Base)
 * @param vaultAddress The vault address
 */
export async function getIPORVaultHistories(
  chainId: number = 8453,
  vaultAddress: string,
): Promise<{ vaultHIPORData: any[]; vaultHIPORFlag: boolean }> {
  let vaultHIPORData: any[] = [];
  let vaultHIPORFlag = true;

  vaultAddress = vaultAddress.toLowerCase();

  const query = `
    query getVaultHistories($vaultAddress: String!){
      plasmaVaultHistories(
        where: {
          plasmaVault: $vaultAddress,
        },
        first: 1000,
        orderBy: timestamp,
        orderDirection: desc
      ) {
        tvl, apy, priceUnderlying, sharePrice, timestamp
      }
    }
  `;

  const variables = { vaultAddress };

  try {
    const data = await executeGraphCall(query, variables);
    vaultHIPORData = data?.plasmaVaultHistories || [];
  } catch (error) {
    console.error("Error fetching vault histories:", error);
    return { vaultHIPORData: [], vaultHIPORFlag: false };
  }

  if (!vaultHIPORData || vaultHIPORData.length === 0) {
    vaultHIPORFlag = false;
  }

  return { vaultHIPORData, vaultHIPORFlag };
}

/**
 * Fetches user balance histories using GraphQL
 * @param vaultAddress The vault address
 * @param chainId The chain ID (default: 8453 for Base)
 * @param userAddress The user's wallet address
 */
export async function getIPORUserBalanceHistories(
  vaultAddress: string,
  chainId: number = 8453,
  userAddress: string,
): Promise<{ balanceIPORData: any[]; balanceIPORFlag: boolean }> {
  let balanceIPORData: any[] = [];
  let balanceIPORFlag = true;

  if (userAddress) {
    userAddress = userAddress.toLowerCase();
  }

  vaultAddress = vaultAddress.toLowerCase();

  const query = `
    query getUserBalanceHistories($userAddress: String!, $vaultAddress: String!) {
      plasmaUserBalanceHistories(
        first: 1000,
        where: {
          plasmaVault: $vaultAddress,
          userAddress: $userAddress,
        },
        orderBy: timestamp,
        orderDirection: desc,
      ) {
        value, timestamp
      }
    }
  `;

  try {
    const data = await executeGraphCall(query, {
      userAddress,
      vaultAddress,
    });
    balanceIPORData = data?.plasmaUserBalanceHistories || [];
  } catch (error) {
    console.error("Error fetching user balance histories:", error);
    return { balanceIPORData: [], balanceIPORFlag: false };
  }

  if (!balanceIPORData || balanceIPORData.length === 0) {
    balanceIPORFlag = false;
  }

  return { balanceIPORData, balanceIPORFlag };
}

/**
 * Fetches TVL (Total Value Locked) data for a specific vault
 * @param vaultAddress The vault address
 * @param period Time period (1d, 7d, 30d, 90d, 365d, all)
 * @param chainId The chain ID (default: 8453 for Base)
 * @param vaultHIPORData Optional pre-fetched vault history data
 * @param vaultHIPORFlag Optional flag indicating if vault history data is valid
 */
export async function fetchTVLData(
  vaultAddress: string,
  period: string = "30d",
  chainId: number = 8453,
  vaultHIPORData?: any[],
  vaultHIPORFlag?: boolean,
): Promise<ChartDataPoint[]> {
  try {
    // If vault history data is not provided, fetch it
    let historyData = vaultHIPORData;
    let historyFlag = vaultHIPORFlag ?? true;

    if (!historyData) {
      const result = await getIPORVaultHistories(chainId, vaultAddress);
      historyData = result.vaultHIPORData;
      historyFlag = result.vaultHIPORFlag;
    }

    if (!historyFlag || !historyData || historyData.length === 0) {
      return [];
    }

    // Filter data based on period using tvl as dataKey
    const filteredData = filterDataByPeriod(historyData, period, "tvl");

    // If no data after filtering, return empty array
    if (filteredData.length === 0) {
      return [];
    }

    // Map to expected format
    return filteredData.map((item: any) => {
      const timestamp = parseInt(item.timestamp);
      // If timestamp is in seconds (< year 2100), convert to milliseconds
      const timestampMs = timestamp < 4102444800 ? timestamp * 1000 : timestamp;

      return {
        timestamp: timestampMs,
        value: parseFloat(item.value || "0"),
      };
    });
  } catch (error) {
    console.error("Error fetching TVL data:", error);
    return [];
  }
}

/**
 * Fetches APY data for a specific vault
 * @param vaultAddress The vault address
 * @param period Time period (1d, 7d, 30d, 90d, 365d, all)
 * @param chainId The chain ID (default: 8453 for Base)
 * @param vaultHIPORData Optional pre-fetched vault history data
 * @param vaultHIPORFlag Optional flag indicating if vault history data is valid
 */
export async function fetchAPYData(
  vaultAddress: string,
  period: string = "30d",
  chainId: number = 8453,
  vaultHIPORData?: any[],
  vaultHIPORFlag?: boolean,
): Promise<ChartDataPoint[]> {
  try {
    // If vault history data is not provided, fetch it
    let historyData = vaultHIPORData;
    let historyFlag = vaultHIPORFlag ?? true;

    if (!historyData) {
      const result = await getIPORVaultHistories(chainId, vaultAddress);
      historyData = result.vaultHIPORData;
      historyFlag = result.vaultHIPORFlag;
    }

    if (!historyFlag || !historyData || historyData.length === 0) {
      return [];
    }

    // Filter data based on period using apy as dataKey
    const filteredData = filterDataByPeriod(historyData, period, "apy");

    // If no data after filtering, return empty array
    if (filteredData.length === 0) {
      return [];
    }

    // Map to expected format and filter out unrealistically high APY values
    const APY_THRESHOLD = 100; // 10000% is the max reasonable APY

    return filteredData
      .map((item: any) => {
        const timestamp = parseInt(item.timestamp);
        // If timestamp is in seconds (< year 2100), convert to milliseconds
        const timestampMs =
          timestamp < 4102444800 ? timestamp * 1000 : timestamp;

        return {
          timestamp: timestampMs,
          value: parseFloat(item.value || "0"),
        };
      })
      .filter((item) => item.value <= APY_THRESHOLD); // Remove items with APY > 10000%
  } catch (error) {
    console.error("Error fetching APY data:", error);
    return [];
  }
}

/**
 * Fetches Share Price data for a specific vault
 * @param vaultAddress The vault address
 * @param period Time period (1d, 7d, 30d, 90d, 365d, all)
 * @param chainId The chain ID (default: 8453 for Base)
 * @param tokenDecimals The number of decimals for the token (default: 18)
 * @param vaultHIPORData Optional pre-fetched vault history data
 * @param vaultHIPORFlag Optional flag indicating if vault history data is valid
 */
export async function fetchSharePriceData(
  vaultAddress: string,
  period: string = "30d",
  chainId: number = 8453,
  tokenDecimals: number = 18,
  vaultHIPORData?: any[],
  vaultHIPORFlag?: boolean,
): Promise<ChartDataPoint[]> {
  try {
    // If vault history data is not provided, fetch it
    let historyData = vaultHIPORData;
    let historyFlag = vaultHIPORFlag ?? true;

    if (!historyData) {
      const result = await getIPORVaultHistories(chainId, vaultAddress);
      historyData = result.vaultHIPORData;
      historyFlag = result.vaultHIPORFlag;
    }

    if (!historyFlag || !historyData || historyData.length === 0) {
      return [];
    }

    // Filter data based on period using sharePrice as dataKey and passing tokenDecimals
    const filteredData = filterDataByPeriod(
      historyData,
      period,
      "sharePrice",
      tokenDecimals,
    );

    // If no data after filtering, return empty array
    if (filteredData.length === 0) {
      return [];
    }

    // Map to expected format
    return filteredData.map((item: any) => {
      const timestamp = parseInt(item.timestamp);
      // If timestamp is in seconds (< year 2100), convert to milliseconds
      const timestampMs = timestamp < 4102444800 ? timestamp * 1000 : timestamp;

      return {
        timestamp: timestampMs,
        value: parseFloat(item.value || "0"),
      };
    });
  } catch (error) {
    console.error("Error fetching share price data:", error);
    return [];
  }
}

function normalizeTimestamp(timestamp: string | number): number {
  const ts = parseInt(String(timestamp));
  return ts < 4102444800 ? ts * 1000 : ts;
}

/**
 * Filter raw subgraph balance snapshots by period.
 * Uses actual data points instead of slot resampling (which collapses
 * recent user history to a single point on longer ranges like "All").
 */
function filterBalanceHistoryByPeriod(data: any[], period: string): any[] {
  if (!data || data.length === 0) {
    return [];
  }

  const sorted = [...data].sort(
    (a, b) => Number(a.timestamp) - Number(b.timestamp),
  );

  const daysAgo = getRangeNumber(period);
  if (daysAgo >= 9999) {
    return sorted;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const periodStartSec = nowSec - daysAgo * 24 * 60 * 60;

  let startIndex = sorted.findIndex(
    (item) => Number(item.timestamp) >= periodStartSec,
  );

  if (startIndex === -1) {
    return sorted.slice(-1);
  }

  if (startIndex > 0) {
    startIndex -= 1;
  }

  return sorted.slice(startIndex);
}

/**
 * Fetches user balance history for a specific vault
 * @param vaultAddress The vault address
 * @param userAddress The user's wallet address
 * @param period Time period (1d, 7d, 30d, 90d, 365d, all)
 * @param chainId The chain ID (default: 8453 for Base)
 * @param vaultDecimals The number of decimals for the vault token (default: 18)
 * @param balanceIPORData Optional pre-fetched user balance history data
 * @param balanceIPORFlag Optional flag indicating if balance history data is valid
 */
export async function fetchUserBalanceData(
  vaultAddress: string,
  userAddress: string,
  period: string = "30d",
  chainId: number = 8453,
  vaultDecimals: number = 18,
  balanceIPORData?: any[],
  balanceIPORFlag?: boolean,
): Promise<UserBalanceChartData> {
  try {
    // If balance history data is not provided, fetch it
    let historyData = balanceIPORData;
    let historyFlag = balanceIPORFlag ?? true;

    if (!historyData) {
      const result = await getIPORUserBalanceHistories(
        vaultAddress,
        chainId,
        userAddress,
      );
      historyData = result.balanceIPORData;
      historyFlag = result.balanceIPORFlag;
    }

    if (!historyFlag || !historyData || historyData.length === 0) {
      return { balance: [] };
    }

    const filteredBalanceData = filterBalanceHistoryByPeriod(
      historyData,
      period,
    );

    if (filteredBalanceData.length === 0) {
      return { balance: [] };
    }

    const divisor = Math.pow(10, vaultDecimals);

    const balance = filteredBalanceData.map((item: any) => ({
      timestamp: normalizeTimestamp(item.timestamp),
      value: parseFloat(item.value || "0") / divisor,
    }));

    return { balance };
  } catch (error) {
    console.error("Error fetching user balance data:", error);
    return { balance: [] };
  }
}

/**
 * Get number of days for a given range
 * @param range Time period (1d, 7d, 30d, 90d, 365d, all)
 */
function getRangeNumber(range: string): number {
  switch (range) {
    case "1d":
    case "1D":
      return 1;
    case "7d":
    case "7D":
      return 7;
    case "30d":
    case "30D":
      return 30;
    case "90d":
    case "90D":
      return 90;
    case "365d":
    case "365D":
      return 365;
    case "all":
    case "ALL":
      return 9999; // Large number to get all data
    default:
      return 30; // Default to 30 days
  }
}

/**
 * Get time slots for chart display
 * @param daysAgo Number of days to go back
 * @param slotCount Number of slots to create
 */
function getTimeSlots(daysAgo: number, slotCount: number): number[] {
  const nowDate = new Date();
  const currentTimeStamp = Math.floor(nowDate.getTime() / 1000);
  const daySeconds = 24 * 60 * 60;
  const slots = [];

  // Calculate time increment between slots
  const timeIncrement = (daysAgo * daySeconds) / slotCount;

  // Generate slots
  for (let i = 0; i < slotCount; i++) {
    const slotTime =
      currentTimeStamp - daysAgo * daySeconds + i * timeIncrement;
    slots.push(slotTime);
  }

  // Add current time as the last slot
  slots.push(currentTimeStamp);

  return slots;
}

/**
 * Generate chart data with time slots
 * @param slots Time slots array
 * @param apiData The data from API
 * @param dataKey Key to extract from data
 */
function generateChartDataWithSlots(
  slots: number[],
  apiData: any[],
  dataKey: string,
): ChartDataPoint[] {
  const seriesData: ChartDataPoint[] = [];
  const sl = slots.length;

  // If no data, return empty array
  if (!apiData || apiData.length === 0) {
    return [];
  }

  for (let i = 0; i < sl; i += 1) {
    // Find the closest data point to the current slot
    if (apiData.length > 0) {
      // Use reduce to find the data point with timestamp closest to the current slot
      const closestPoint = apiData.reduce((prev, curr) =>
        Math.abs(Number(curr.timestamp) - slots[i]) <
        Math.abs(Number(prev.timestamp) - slots[i])
          ? curr
          : prev,
      );

      // Extract the value using the dataKey, handle null or undefined values
      let value = 0;
      if (
        closestPoint[dataKey] !== null &&
        closestPoint[dataKey] !== undefined
      ) {
        value = parseFloat(closestPoint[dataKey] || "0");
      }

      // Add the data point to our result with timestamp in milliseconds
      seriesData.push({
        timestamp: slots[i] * 1000, // Convert to milliseconds
        value: value,
      });
    } else {
      // If no data points, add a zero value
      seriesData.push({
        timestamp: slots[i] * 1000, // Convert to milliseconds
        value: 0,
      });
    }
  }

  return seriesData;
}

/**
 * Filter data by time period, matching Harvest Finance's implementation
 * @param data The data to filter
 * @param period Time period (1d, 7d, 30d, 90d, 365d, all)
 * @param dataKey The key to extract from data (tvl, apy, sharePrice, value)
 * @param decimals Optional token decimals for sharePrice calculations
 */
function filterDataByPeriod(
  data: any[],
  period: string,
  dataKey: string = "value",
  decimals: number = 18,
): any[] {
  if (!data || data.length === 0) {
    return [];
  }

  // Sort data by timestamp (ascending)
  const sortedData = [...data].sort((a, b) => {
    const timestampA = parseInt(a.timestamp);
    const timestampB = parseInt(b.timestamp);
    return timestampA - timestampB; // Ascending order (oldest first)
  });

  const nowDate = new Date();
  const currentTimeStamp = Math.floor(nowDate.getTime() / 1000);

  // Find first valid data point
  let firstDate = sortedData[0].timestamp;
  for (let i = 0; i < sortedData.length; i++) {
    // Get the value based on dataKey
    const value = sortedData[i][dataKey];
    if (value !== 0 && value !== "0") {
      firstDate = sortedData[i].timestamp;
      break;
    }
  }

  // Get the days for the selected period
  const daysAgo = getRangeNumber(period);

  // Determine number of slots based on the range
  let slotCount = 50; // Default slot count
  if (daysAgo > 700) {
    slotCount = 500;
  } else if (daysAgo > 365) {
    slotCount = 400;
  } else if (daysAgo > 180) {
    slotCount = 300;
  } else if (daysAgo > 90) {
    slotCount = 150;
  } else if (daysAgo > 60) {
    slotCount = 100;
  } else if (daysAgo > 30) {
    slotCount = 100;
  }

  // Generate time slots
  const slots = getTimeSlots(daysAgo, slotCount);

  // Filter slots to only include those after the first valid data point
  const filteredSlots = slots.filter(
    (timestamp) => timestamp >= Number(firstDate),
  );

  // Process data differently based on dataKey
  const processedData = sortedData
    .map((item) => {
      const newItem = { ...item };

      // If this is sharePrice data, divide by token decimals
      if (dataKey === "sharePrice" && decimals > 0) {
        const divisor = Math.pow(10, decimals);
        if (newItem[dataKey]) {
          newItem[dataKey] = parseFloat(newItem[dataKey]) / divisor;
        }
      }
      // If this is APY data, convert to percentage
      else if (dataKey === "apy" && newItem[dataKey]) {
        const apyValue = parseFloat(newItem[dataKey]);

        // Cap unrealistically high APY values at a reasonable threshold
        const APY_MAX_THRESHOLD = 10000; // 10000% max
        if (apyValue > APY_MAX_THRESHOLD) {
          newItem[dataKey] = null; // Mark as null to be filtered out later
        } else {
          newItem[dataKey] = apyValue;
        }
      }

      return newItem;
    })
    .filter((item) => item[dataKey] !== null); // Filter out null values

  // Generate chart data using slots
  const result = generateChartDataWithSlots(
    filteredSlots,
    processedData,
    dataKey,
  );
  return result;
}

/**
 * Fetches all chart data for a vault in parallel
 * @param vaultAddress The vault address
 * @param userAddress The user's wallet address (optional)
 * @param period Time period (1d, 7d, 30d, 90d, 365d, all)
 * @param chainId The chain ID (default: 8453 for Base)
 * @param vaultDecimals The number of decimals for the vault token (default: 18)
 * @param tokenDecimals The number of decimals for the underlying token (default: 18)
 * @param vaultHIPORData Optional pre-fetched vault history data
 * @param vaultHIPORFlag Optional flag indicating if vault history data is valid
 * @param balanceIPORData Optional pre-fetched user balance history data
 * @param balanceIPORFlag Optional flag indicating if user balance history data is valid
 */
export async function fetchAllChartData(
  vaultAddress: string,
  userAddress?: string,
  period: string = "30d",
  chainId: number = 8453,
  vaultDecimals: number = 18,
  tokenDecimals: number = 18,
  vaultHIPORData?: any[],
  vaultHIPORFlag?: boolean,
  balanceIPORData?: any[],
  balanceIPORFlag?: boolean,
): Promise<{
  tvl: ChartDataPoint[];
  apy: ChartDataPoint[];
  sharePrice: ChartDataPoint[];
  userBalance?: UserBalanceChartData;
}> {
  try {
    // Fetch vault history data once if not provided
    let historyData = vaultHIPORData;
    let historyFlag = vaultHIPORFlag ?? true;

    if (!historyData) {
      const result = await getIPORVaultHistories(chainId, vaultAddress);
      historyData = result.vaultHIPORData;
      historyFlag = result.vaultHIPORFlag;
    }

    // Create promises for the different chart data types, passing the vault history data
    const tvlPromise = fetchTVLData(
      vaultAddress,
      period,
      chainId,
      historyData,
      historyFlag,
    );

    const apyPromise = fetchAPYData(
      vaultAddress,
      period,
      chainId,
      historyData,
      historyFlag,
    );

    const sharePricePromise = fetchSharePriceData(
      vaultAddress,
      period,
      chainId,
      tokenDecimals,
      historyData,
      historyFlag,
    );

    // Conditionally create user balance promise
    let userBalancePromise: Promise<UserBalanceChartData | undefined> =
      Promise.resolve(undefined);
    if (userAddress) {
      // For user balance, use pre-fetched data if available, otherwise fetch it
      userBalancePromise = fetchUserBalanceData(
        vaultAddress,
        userAddress,
        period,
        chainId,
        vaultDecimals,
        balanceIPORData,
        balanceIPORFlag,
      );
    }

    // Execute all promises in parallel with proper typing
    const [tvl, apy, sharePrice, userBalance] = await Promise.all([
      tvlPromise,
      apyPromise,
      sharePricePromise,
      userBalancePromise,
    ]);

    return {
      tvl,
      apy,
      sharePrice,
      userBalance,
    };
  } catch (error) {
    console.error("Error fetching all chart data:", error);
    return {
      tvl: [],
      apy: [],
      sharePrice: [],
      userBalance: undefined,
    };
  }
}
