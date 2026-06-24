export interface TokenInfo {
  symbol: string;
  name: string;
  id: string;
  icon: string;
  image?: string;
  images?: string[];
  address: `0x${string}` | undefined;
  decimals: number;
  balance: string;
  rawBalance: string;
  balanceUSD: string;
  price: string;
}

export interface VaultInfo {
  symbol: string;
  name: string;
  id: string;
  icon: string;
  image?: string;
  images?: string[];
  address: `0x${string}`;
  vaultAddress: `0x${string}`;
  decimals: number;
  vaultDecimals: number;
  balance: string;
  rawBalance: string;
  balanceUSD: string;
  vaultSymbol: string;
}

export interface AllocPointData {
  hVaultId: string;
  allocPoint: string;
  apy: string | number;
}

export interface HarvestVaultData {
  id: string;
  estimatedApy: string;
  totalValueLocked: string;
  inactive: boolean;
  vaultAddress?: string;
  allocPointData?: AllocPointData[];
  usdPrice?: string;
  sharePrice?: string;
  pricePerFullShare?: string;
  decimals?: number;
}

export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  image?: string;
  images?: string[];
}

export interface AnalyticsData {
  action: string;
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  vaultAddress?: string;
  vaultSymbol?: string;
  txHash: string;
  chainId: number;
  walletAddress: string;
  timestamp: string;
}

export interface ConvertModalProps {
  chainId: number;
  isOpen: boolean;
  onClose: () => void;
  selectedToken: TokenInfo;
  depositAmount: string;
  vaultAddress: `0x${string}` | null;
  onSuccess?: () => void;
  walletAddress: `0x${string}` | null;
  handleWalletInteraction: (action: () => Promise<void>) => Promise<void>;
}

export interface RevertModalProps {
  chainId: number;
  isOpen: boolean;
  onClose: () => void;
  selectedToken: TokenInfo;
  withdrawAmount: string;
  selectedVault: VaultInfo;
  onSuccess?: () => void;
  walletAddress: `0x${string}` | null;
  handleWalletInteraction: (action: () => Promise<void>) => Promise<void>;
}

export interface UserBalancesProps {
  vault: VaultInfo;
  balance: TokenInfo | null;
}

// Type definitions for chart data
export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

export interface APYChartProps {
  vaultAddress: string | null;
  period?: string;
  height?: number;
  chainId?: number;
  cachedData?: ChartDataPoint[];
  isLoading?: boolean;
}

export interface VaultChartData {
  tvl: ChartDataPoint[];
  apy: ChartDataPoint[];
  sharePrice: ChartDataPoint[];
}

export interface UserBalanceChartData {
  balance: ChartDataPoint[];
}

export interface UserBalanceChartProps {
  vaultAddress: string | null;
  userAddress: string | null;
  period?: string;
  height?: number;
  chainId?: number;
  vaultDecimals?: number;
  vaultId?: string;
  cachedData?: UserBalanceChartData;
  isLoading?: boolean;
}

export interface SharePriceChartProps {
  vaultAddress: string | null;
  period?: string;
  height?: number;
  chainId?: number;
  className?: string;
  cachedData?: ChartDataPoint[];
  isLoading?: boolean;
  tokenDecimals?: number;
}

export interface TVLChartProps {
  vaultAddress: string | null;
  period?: string;
  height?: number;
  chainId?: number;
  cachedData?: ChartDataPoint[];
  isLoading?: boolean;
}

export interface ChartSectionProps {
  vaultAddress: string | null;
  walletAddress: string | null;
  vaultSymbol: string;
  isWalletConnected: boolean;
  chainId?: number; // Make chainId optional with a default value
  refreshKey?: number;
}

// Interface for cached chart data
export interface CachedChartData {
  tvl?: ChartDataPoint[];
  apy?: ChartDataPoint[];
  sharePrice?: ChartDataPoint[];
  userBalance?: UserBalanceChartData;
  period: string;
}

// Interface for vault history data
export interface VaultHistoryData {
  vaultHIPORData: // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any[];
  vaultHIPORFlag: boolean;
}

// Interface for user balance history data
export interface UserBalanceHistoryData {
  balanceIPORData: // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any[];
  balanceIPORFlag: boolean;
}
