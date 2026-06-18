import { useEffect, useState, useCallback, useRef } from "react";
import Head from "next/head";
import type { JSX } from "react";
import BigNumber from "bignumber.js";
import { Button } from "~/components/Button";
import { base } from "viem/chains";
import {
  useConnection,
  useConnect,
  useConnectors,
  useSwitchChain,
  type Connector,
} from "wagmi";
import ConvertTokenSelectModal from "./convert/TokenSelectModal";
import RevertTokenSelectModal from "./revert/TokenSelectModal";
import ConvertModal from "./convert/ConvertModal";
import RevertModal from "./revert/RevertModal";
import type { TokenInfo, VaultInfo, Token } from "~/types";
import { usePortals } from "~/providers/Portals";
import { formatBalance, formatTVL } from "~/utilities/parsers";
import ChartSection from "./Charts/ChartSection";
import { useVaultsData } from "~/hooks/useVaultsData";

import { SUPPORTED_VAULTS, FALLBACK_TOKEN_ICON } from "~/constants";

export default function App(): JSX.Element {
  const { vaultsData } = useVaultsData();
  const { address, isConnected, chainId: connectedChainId } = useConnection();
  const connect = useConnect();
  const connectors = useConnectors();
  const { mutate: switchToBaseChain } = useSwitchChain();
  const [selectedVault, setSelectedVault] = useState<string | null>("USDC");
  const [vaultBalances, setVaultBalances] = useState<{
    [key: string]: TokenInfo | null;
  }>({});
  const [selectedToken, setSelectedToken] = useState<TokenInfo>({
    symbol: "USDC",
    name: "USD Coin",
    id: "IPOR_USDC_base",
    icon: "/images/tokens/usdc.svg",
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    decimals: 6,
    balance: "0",
    balanceUSD: "0",
    price: "0",
    images: ["/images/tokens/usdc.svg"],
    rawBalance: "0",
  });
  const [depositAmount, setDepositAmount] = useState<string>("0");
  const [vaultAddress, setVaultAddress] = useState<`0x${string}` | null>(null);
  const [isConvertTokenModalOpen, setIsConvertTokenModalOpen] = useState(false);
  const [isRevertTokenModalOpen, setIsRevertTokenModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<TokenInfo[]>([]);
  const { getPortalsBalances, SUPPORTED_TOKEN_LIST, getPortalsBaseTokens } =
    usePortals();
  const walletAddress = address ?? null;
  const isWalletConnected = isConnected;
  const chainId: number = base.id;
  const [supportedTokens, setSupportedTokens] = useState<TokenInfo[]>([]);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null);
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<"deposit" | "withdraw">(
    "deposit",
  );
  const [selectedChartVault, setSelectedChartVault] =
    useState<VaultInfo | null>(null);

  // Add a ref for the chart section
  const chartSectionRef = useRef<HTMLDivElement>(null);

  // Scroll to chart section function
  const scrollToCharts = () => {
    if (chartSectionRef.current) {
      // Add a small delay to ensure UI has updated
      setTimeout(() => {
        chartSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 100);
    }
  };

  // Show notification function
  const showNotification = (
    message: string,
    type: "error" | "success" = "error",
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 10000); // Auto-hide after 10 seconds
  };

  // Helper to safely get vault balance
  const getVaultBalance = (vaultSymbol: string | null): TokenInfo | null => {
    if (!vaultSymbol) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return vaultBalances[vaultSymbol as any] || null;
  };

  // Set initial vault address for USDC
  useEffect(() => {
    setVaultAddress(SUPPORTED_VAULTS[0].vaultAddress as `0x${string}`);
    setSelectedVault("USDC");
  }, []);

  // Handle wallet interactions
  const handleWalletInteraction = async (action: () => Promise<void>) => {
    await action();
  };

  // Switch to Base chain if needed
  useEffect(() => {
    if (
      isWalletConnected &&
      connectedChainId &&
      connectedChainId !== base.id
    ) {
      switchToBaseChain({ chainId: base.id });
    }
  }, [isWalletConnected, connectedChainId, switchToBaseChain]);

  // Clear balances when wallet disconnects
  useEffect(() => {
    if (!isWalletConnected) {
      setTokenBalances([]);
      setVaultBalances({});
      setSupportedTokens([]);
    }
  }, [isWalletConnected]);

  // Fetch balances function
  const fetchBalances = useCallback(async () => {
    if (isBalanceLoading) {
      return;
    }

    if (!walletAddress) {
      const defaultTokens = SUPPORTED_VAULTS.map((token) => ({
        ...token,
        balance: "0",
        balanceUSD: "0",
        price: "0",
      })) as TokenInfo[];

      setTokenBalances(defaultTokens);
      setVaultBalances({});
      setSupportedTokens(defaultTokens);
      return;
    }

    try {
      setIsBalanceLoading(true);

      // Only fetch balances, not base tokens (that's handled separately)
      const balances = await getPortalsBalances(walletAddress, chainId);

      const defaultTokens = SUPPORTED_VAULTS.map((token) => ({
        ...token,
        balance: "0",
        balanceUSD: "0",
        price: "0",
      })) as TokenInfo[];

      // Process all balances
      const newVaultBalances: { [key: string]: TokenInfo | null } = {};
      const tokensWithBalance: TokenInfo[] = [];

      if (balances && balances.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        balances.forEach((balance: any) => {
          const tokenAddress = balance.address?.toLowerCase();
          const matchingVault = SUPPORTED_VAULTS.find(
            (vault) => vault.vaultAddress?.toLowerCase() === tokenAddress,
          );

          if (matchingVault) {
            // This is a vault token
            const price = new BigNumber(balance.balanceUSD)
              .div(new BigNumber(balance.balance))
              .toString();

            newVaultBalances[matchingVault.symbol] = {
              symbol: normalizeTokenSymbol(balance.symbol),
              name: balance.name,
              id: `${normalizeTokenSymbol(balance.symbol).toLowerCase()}_${chainId}`,
              icon: balance.image || balance.images?.[0] || FALLBACK_TOKEN_ICON,
              address: balance.address as `0x${string}`,
              decimals: balance.decimals,
              balance: balance.balance.toString(),
              balanceUSD: balance.balanceUSD.toString(),
              price: balance.price ?? price,
              rawBalance: balance.rawBalance.toString(),
            };
          } else if (Number(balance.balanceUSD) > 0) {
            // This is a regular token with positive balance
            const price = new BigNumber(balance.balanceUSD)
              .div(new BigNumber(balance.balance))
              .toString();

            tokensWithBalance.push({
              symbol: normalizeTokenSymbol(balance.symbol),
              name: balance.name,
              id: `${normalizeTokenSymbol(balance.symbol).toLowerCase()}_${chainId}`,
              icon: balance.image || balance.images?.[0] || FALLBACK_TOKEN_ICON,
              address: balance.address as `0x${string}`,
              decimals: balance.decimals,
              balance: balance.balance.toString(),
              balanceUSD: balance.balanceUSD.toString(),
              price: balance.price ?? price,
              rawBalance: balance.rawBalance.toString(),
            });
          }
        });

        // Set null for vaults without balances
        SUPPORTED_VAULTS.forEach((vault) => {
          if (!newVaultBalances[vault.symbol]) {
            newVaultBalances[vault.symbol] = null;
          }
        });

        setVaultBalances(newVaultBalances);
        setTokenBalances(tokensWithBalance);
      } else {
        setVaultBalances({});
        setTokenBalances(defaultTokens);
      }
    } catch (error) {
      console.error("Failed to fetch balances:", error);

      const defaultTokens = SUPPORTED_VAULTS.map((token) => ({
        ...token,
        balance: "0",
        balanceUSD: "0",
        price: "0",
      })) as TokenInfo[];

      setTokenBalances(defaultTokens);
      setVaultBalances({});
      setSupportedTokens(defaultTokens);
    } finally {
      setIsBalanceLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, chainId, getPortalsBalances]);

  // Fetch balances when critical dependencies change
  useEffect(() => {
    if (walletAddress && chainId) {
      fetchBalances();
    }
  }, [walletAddress, chainId, fetchBalances]);

  // Extract fetchSupportedTokens as a standalone function so it can be reused
  const fetchSupportedTokens = useCallback(async () => {
    if (!chainId || !walletAddress) return; // Only fetch when wallet is connected

    try {
      const tokens = await getPortalsBaseTokens(chainId);
      if (tokens) {
        // Get balances since address is available
        const balances =
          (await getPortalsBalances(walletAddress, chainId)) || [];

        const tokenInfos = tokens.map((token: Token) => {
          // Find matching balance info
          const balanceInfo = balances.find(
            (b) => b.address?.toLowerCase() === token.address?.toLowerCase(),
          );

          return {
            symbol: normalizeTokenSymbol(token.symbol),
            name: token.name,
            id: `${normalizeTokenSymbol(token.symbol).toLowerCase()}_${chainId}`,
            icon: token.image || token.images?.[0] || FALLBACK_TOKEN_ICON,
            address: token.address as `0x${string}`,
            decimals: token.decimals,
            balance: balanceInfo ? balanceInfo.balance.toString() : "0",
            balanceUSD: balanceInfo ? balanceInfo.balanceUSD.toString() : "0",
            price: balanceInfo
              ? new BigNumber(balanceInfo.balanceUSD)
                  .div(new BigNumber(balanceInfo.balance))
                  .toString()
              : "0",
            images: token.images,
            rawBalance: balanceInfo ? balanceInfo.rawBalance.toString() : "0",
          };
        });
        setSupportedTokens(tokenInfos);
      }
    } catch (error) {
      console.error("Failed to fetch supported tokens:", error);
    }
  }, [chainId, walletAddress, getPortalsBaseTokens, getPortalsBalances]);

  // Call fetchSupportedTokens directly when dependencies change
  useEffect(() => {
    if (chainId && walletAddress) {
      fetchSupportedTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, walletAddress]); // Only run when chainId or walletAddress changes

  // Update the success handlers
  const handleConvertSuccess = async () => {
    setIsConvertModalOpen(false);
    setIsAmountModalOpen(false);
    setDepositAmount("0");
    await fetchBalances();
    await fetchSupportedTokens();

    if (!walletAddress) return;

    const updatedBalances = await getPortalsBalances(walletAddress, chainId);
    if (updatedBalances) {
      const currentToken = updatedBalances.find(
        (b) =>
          b.address &&
          selectedToken.address &&
          b.address.toLowerCase() === selectedToken.address.toLowerCase(),
      );

      if (!currentToken || Number(currentToken.balanceUSD) <= 0) {
        const nextToken = updatedBalances.find(
          (b) =>
            b.address &&
            Number(b.balanceUSD) > 0 &&
            b.address.toLowerCase() !== vaultAddress?.toLowerCase(),
        );

        if (nextToken) {
          setSelectedToken({
            symbol: nextToken.symbol,
            name: nextToken.name,
            id: `${nextToken.symbol.toLowerCase()}_${chainId}`,
            icon:
              nextToken.image || nextToken.images?.[0] || FALLBACK_TOKEN_ICON,
            address: nextToken.address as `0x${string}`,
            decimals: nextToken.decimals,
            balance: nextToken.balance.toString(),
            balanceUSD: nextToken.balanceUSD.toString(),
            price: new BigNumber(nextToken.balanceUSD)
              .div(new BigNumber(nextToken.balance))
              .toString(),
            images: nextToken.images,
            rawBalance: nextToken.rawBalance.toString(),
          });
        }
      } else if (Number(currentToken.balanceUSD) > 0) {
        setSelectedToken({
          symbol: currentToken.symbol,
          name: currentToken.name,
          id: `${currentToken.symbol.toLowerCase()}_${chainId}`,
          icon:
            currentToken.image ||
            currentToken.images?.[0] ||
            FALLBACK_TOKEN_ICON,
          address: currentToken.address as `0x${string}`,
          decimals: currentToken.decimals,
          balance: currentToken.balance.toString(),
          balanceUSD: currentToken.balanceUSD.toString(),
          price: new BigNumber(currentToken.balanceUSD)
            .div(new BigNumber(currentToken.balance))
            .toString(),
          images: currentToken.images,
          rawBalance: currentToken.rawBalance.toString(),
        });
      }
    }
  };

  const handleRevertSuccess = async () => {
    setIsRevertModalOpen(false);
    setIsAmountModalOpen(false);
    setDepositAmount("0");
    setVaultBalances({});
    await fetchBalances();
    await fetchSupportedTokens(); // Add this line to fetch supported tokens after revert

    if (!walletAddress) return;

    const updatedBalances = await getPortalsBalances(walletAddress, chainId);
    if (updatedBalances) {
      const currentVaultToken = updatedBalances.find(
        (b) =>
          b.address &&
          vaultAddress &&
          b.address.toLowerCase() === vaultAddress.toLowerCase(),
      );

      if (!currentVaultToken || Number(currentVaultToken.balanceUSD) <= 0) {
        setSelectedToken({
          symbol: "USDC",
          name: "USD Coin",
          id: "IPOR_USDC_base",
          icon: "/images/tokens/usdc.svg",
          address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimals: 6,
          balance: "0",
          balanceUSD: "0",
          price: "0",
          images: ["/images/tokens/usdc.svg"],
          rawBalance: "0",
        });
      }
    }
  };

  // Add token symbol normalization
  const normalizeTokenSymbol = (symbol: string) => {
    const symbolMap: { [key: string]: string } = {
      CBBTC: "cbBTC",
    };
    return symbolMap[symbol] || symbol;
  };

  // Handle deposit from vault card
  const handleDepositClick = (vault: VaultInfo) => {
    setSelectedVault(vault.symbol);
    setVaultAddress(vault.vaultAddress);
    setActiveVault(vault);
    setCurrentAction("deposit");
    setSelectedChartVault(vault); // Show charts for this vault
    scrollToCharts(); // Scroll to the charts

    // Find a matching token for deposit
    const token = tokenBalances.find((t) => t.symbol === vault.symbol);

    if (token) {
      setSelectedToken(token);
      // Open token select modal first
      setIsConvertTokenModalOpen(true);
    } else {
      // If no matching token found, use a default one
      setSelectedToken({
        symbol: vault.symbol,
        name: vault.name,
        id: vault.id,
        icon: vault.icon,
        address: vault.address,
        decimals: vault.decimals,
        balance: "0",
        balanceUSD: "0",
        price: "0",
        images: vault.images || [vault.icon],
        rawBalance: "0",
      });
      setIsConvertTokenModalOpen(true);
    }
  };

  // Handle withdraw from vault card
  const handleWithdrawClick = (vault: VaultInfo) => {
    setSelectedVault(vault.symbol);
    setVaultAddress(vault.vaultAddress);
    setActiveVault(vault);
    setCurrentAction("withdraw");
    setSelectedChartVault(vault); // Show charts for this vault
    scrollToCharts(); // Scroll to the charts

    // Use a default token for withdrawal
    const defaultToken = supportedTokens.find(
      (t) => t.symbol === vault.symbol,
    ) || {
      symbol: vault.symbol,
      name: vault.name,
      id: vault.id,
      icon: vault.icon,
      address: vault.address,
      decimals: vault.decimals,
      balance: "0",
      balanceUSD: "0",
      price: "0",
      images: vault.images || [vault.icon],
      rawBalance: "0",
    };

    setSelectedToken(defaultToken);

    // Check if there's a balance for withdrawal
    const vaultBalance = getVaultBalance(vault.symbol);
    if (vaultBalance && parseFloat(vaultBalance.balance) > 0) {
      setDepositAmount("0"); // Reset amount before opening modal
      // Open token selection modal first
      setIsRevertTokenModalOpen(true);
    } else {
      showNotification(
        `You don't have any ${vault.vaultSymbol} to withdraw`,
        "error",
      );
    }
  };

  // Handle amount confirmation
  const handleAmountConfirm = () => {
    // Validate amount before proceeding
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    // For deposit flow
    if (currentAction === "deposit") {
      // Check if user has enough balance
      if (selectedToken) {
        const availableBalance = new BigNumber(selectedToken.rawBalance).div(
          new BigNumber(10).pow(selectedToken.decimals),
        );

        if (new BigNumber(depositAmount).gt(availableBalance)) {
          showNotification(
            `Insufficient ${selectedToken.symbol} balance. Available: ${formatBalance(selectedToken.balance)}`,
            "error",
          );
          return;
        }
      }

      // Open deposit modal directly
      setIsAmountModalOpen(false);
      setIsConvertModalOpen(true);
    }
    // For withdraw flow
    else if (currentAction === "withdraw") {
      const vaultBalance = getVaultBalance(selectedVault);
      if (vaultBalance) {
        const availableBalance = new BigNumber(vaultBalance.rawBalance).div(
          new BigNumber(10).pow(vaultBalance.decimals),
        );

        if (new BigNumber(depositAmount).gt(availableBalance)) {
          const vaultSymbol =
            SUPPORTED_VAULTS.find((v) => v.symbol === selectedVault)
              ?.vaultSymbol || "";
          showNotification(
            `Insufficient ${vaultSymbol} balance. Available: ${formatBalance(vaultBalance.balance)}`,
            "error",
          );
          return;
        }
      }

      // Open withdraw modal directly
      setIsAmountModalOpen(false);
      setIsRevertModalOpen(true);
    }
  };

  // Add handler for vault detail click
  const handleVaultDetailClick = (vault: VaultInfo) => {
    setSelectedChartVault(vault);
  };

  // Add this function to show vault details when a user has a balance
  const showVaultDetailsIfBalance = (vault: VaultInfo) => {
    const vaultBalance = getVaultBalance(vault.symbol);
    if (vaultBalance && parseFloat(vaultBalance.balance) > 0) {
      setSelectedChartVault(vault);
      return true;
    }
    return false;
  };

  // Update the useEffect that runs when wallet is connected to check for balances
  useEffect(() => {
    if (isWalletConnected && walletAddress) {
      // Find the first vault with a balance to show its details
      if (
        Object.values(vaultBalances).some(
          (balance) => balance && parseFloat(balance.balance) > 0,
        )
      ) {
        // Find the first vault with a balance
        for (const vault of SUPPORTED_VAULTS) {
          if (showVaultDetailsIfBalance(vault)) {
            break; // Show only the first vault with a balance
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletConnected, walletAddress, vaultBalances]);

  const handleConnectWallet = () => {
    const connector: Connector | undefined =
      connectors.find((c: Connector) => c.id === "baseAccount") ??
      connectors.find((c: Connector) => c.id === "injected") ??
      connectors[0];
    if (connector) {
      connect.mutate({ connector });
    }
  };

  // Not connected state with custom UI
  if (!isWalletConnected) {
    return (
      <div className="w-[300px] mx-auto pt-16 px-2">
        <h1 className="text-2xl font-bold text-center mb-4">
          Harvest on Autopilot 🌾
        </h1>
        <div className="flex flex-col items-center gap-4">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Please connect your wallet to view your positions
          </p>
          <Button onClick={handleConnectWallet} disabled={connect.isPending}>
            {connect.isPending ? "Connecting..." : "Connect Wallet"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-lg mx-auto px-2 py-3">
          <h1 className="text-xl font-bold text-center mb-4">
            Harvest on Autopilot 🌾
          </h1>

          {/* Notification */}
          {notification && (
            <div
              className={`mb-4 p-3 rounded-lg border ${
                notification.type === "error"
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                  : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
              }`}
            >
              <div className="flex justify-between items-center">
                <p className="text-sm">{notification.message}</p>
                <button
                  onClick={() => setNotification(null)}
                  className="text-current hover:opacity-70 ml-2"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="space-y-4">
            {/* Your Balance Section - Only visible when user has balances */}
            {isWalletConnected &&
              Object.values(vaultBalances).some(
                (balance) => balance && parseFloat(balance.balance) > 0,
              ) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-4">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-md font-semibold">Your Positions</h2>
                  </div>
                  <div className="grid grid-cols-1 divide-y divide-gray-100 dark:divide-gray-700">
                    {Object.entries(vaultBalances)
                      .filter(
                        ([_, balance]) =>
                          balance && parseFloat(balance.balance) > 0,
                      )
                      .map(([symbol, balance]) => {
                        const vault = SUPPORTED_VAULTS.find(
                          (v) => v.symbol === symbol,
                        );
                        if (!vault || !balance) return null;

                        return (
                          <div key={symbol} className="p-4">
                            <div className="flex items-center justify-between">
                              {/* Vault Info - Clickable for Charts */}
                              <button
                                className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
                                onClick={() => handleVaultDetailClick(vault)}
                              >
                                <img
                                  src={vault.icon}
                                  alt={vault.symbol}
                                  className="w-10 h-10"
                                />
                                <div>
                                  <div className="font-medium">
                                    {vault.vaultSymbol}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatBalance(balance.balance)} ($
                                    {formatBalance(balance.balanceUSD)})
                                  </div>
                                </div>
                              </button>

                              {/* Action Buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleWithdrawClick(vault)}
                                  className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
                                >
                                  Withdraw
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            {/* Deposit Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-4">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-md font-semibold">Deposit & Earn</h2>
              </div>

              <div className="grid grid-cols-1 divide-y divide-gray-100 dark:divide-gray-700">
                {SUPPORTED_VAULTS.map((vault) => {
                  const vaultData = vaultsData?.[vault.id];

                  return (
                    <div key={vault.symbol} className="p-4">
                      <div className="flex items-center justify-between">
                        {/* Vault Info - Clickable for Charts */}
                        <button
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
                          onClick={() => handleVaultDetailClick(vault)}
                        >
                          <img
                            src={vault.icon}
                            alt={vault.symbol}
                            className="w-10 h-10"
                          />
                          <div>
                            <div className="font-medium">{vault.symbol}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {vaultData
                                ? `${parseFloat(vaultData.estimatedApy).toFixed(2)}% APY`
                                : "Loading..."}
                              {vaultData
                                ? ` • ${formatTVL(vaultData.totalValueLocked)} TVL`
                                : ""}
                            </div>
                          </div>
                        </button>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDepositClick(vault)}
                            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
                          >
                            Deposit
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart Section - shown below the Deposit & Earn section */}
            {selectedChartVault && (
              <div
                ref={chartSectionRef}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={selectedChartVault.icon}
                    alt={selectedChartVault.symbol}
                    className="w-8 h-8"
                  />
                  <h2 className="text-lg font-semibold">
                    {selectedChartVault.symbol} Vault Analytics
                  </h2>
                </div>

                {/* Vault Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      APY
                    </div>
                    <div className="text-lg font-medium text-green-600">
                      {vaultsData?.[selectedChartVault.id]
                        ? `${parseFloat(vaultsData[selectedChartVault.id].estimatedApy).toFixed(2)}%`
                        : "Loading..."}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      TVL
                    </div>
                    <div className="text-lg font-medium">
                      {vaultsData?.[selectedChartVault.id]
                        ? formatTVL(
                            vaultsData[selectedChartVault.id].totalValueLocked,
                          )
                        : "Loading..."}
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <ChartSection
                  vaultAddress={selectedChartVault.vaultAddress}
                  walletAddress={walletAddress}
                  vaultSymbol={selectedChartVault.vaultSymbol}
                  isWalletConnected={isWalletConnected}
                  chainId={chainId}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Token Selection Modals */}
      {isConvertTokenModalOpen && (
        <ConvertTokenSelectModal
          isOpen={isConvertTokenModalOpen}
          onClose={() => setIsConvertTokenModalOpen(false)}
          onSelect={(token: TokenInfo) => {
            setSelectedToken(token);
            setIsConvertTokenModalOpen(false);
            // Open amount input modal after token selection
            setDepositAmount("0"); // Reset amount for new token
            setIsAmountModalOpen(true);
          }}
          selectedToken={tokenBalances.find(
            (t) => t.symbol === selectedToken.symbol,
          )}
          tokens={[
            ...tokenBalances,
            // Add vault tokens to the list
            ...Object.entries(vaultBalances)
              .filter(
                ([symbol, vaultToken]) =>
                  symbol !== selectedVault &&
                  vaultToken !== null &&
                  Number(vaultToken.balance) > 0,
              )
              .map(([_, vaultToken]) => vaultToken as TokenInfo),
          ].sort((a, b) => Number(b.balanceUSD) - Number(a.balanceUSD))}
        />
      )}

      {isRevertTokenModalOpen && (
        <RevertTokenSelectModal
          isOpen={isRevertTokenModalOpen}
          onClose={() => setIsRevertTokenModalOpen(false)}
          onSelect={(token: TokenInfo) => {
            setSelectedToken(token);
            setIsRevertTokenModalOpen(false);
            // Open amount input modal after token selection
            setDepositAmount("0"); // Reset amount for new token
            setIsAmountModalOpen(true);
          }}
          selectedToken={selectedToken}
          tokens={[
            ...supportedTokens.filter((token) => {
              if (!token.address || !vaultAddress) return false;
              const currentVault = SUPPORTED_VAULTS.find(
                (v) => v.symbol === selectedVault,
              );
              if (!currentVault) return false;
              const supportedAddresses = Object.values(
                SUPPORTED_TOKEN_LIST[
                  chainId as keyof typeof SUPPORTED_TOKEN_LIST
                ] || {},
              ).map((addr) => addr.toLowerCase());
              const isBaseToken =
                token.address.toLowerCase() ===
                currentVault.address.toLowerCase();
              const isInSupportedList = supportedAddresses.includes(
                token.address.toLowerCase(),
              );
              return isBaseToken || isInSupportedList;
            }),
            // Add vault tokens to the list
            ...Object.entries(vaultBalances)
              .filter(
                ([symbol, vaultToken]) =>
                  symbol !== selectedVault &&
                  vaultToken !== null &&
                  Number(vaultToken.balance) > 0,
              )
              .map(([_, vaultToken]) => vaultToken as TokenInfo),
          ].sort((a, b) => Number(b.balanceUSD) - Number(a.balanceUSD))}
        />
      )}

      {isConvertModalOpen && (
        <ConvertModal
          chainId={chainId}
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          selectedToken={selectedToken}
          depositAmount={depositAmount}
          vaultAddress={vaultAddress}
          onSuccess={handleConvertSuccess}
          walletAddress={walletAddress}
          handleWalletInteraction={handleWalletInteraction}
        />
      )}

      {isRevertModalOpen && activeVault && (
        <RevertModal
          chainId={chainId}
          isOpen={isRevertModalOpen}
          onClose={() => setIsRevertModalOpen(false)}
          selectedToken={selectedToken}
          withdrawAmount={depositAmount}
          selectedVault={activeVault}
          onSuccess={handleRevertSuccess}
          walletAddress={walletAddress}
          handleWalletInteraction={handleWalletInteraction}
        />
      )}

      {/* Amount Input Modal */}
      {isAmountModalOpen && activeVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsAmountModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg p-5 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <span className="mr-1">
                  {currentAction === "deposit" ? "Deposit" : "Withdraw as"}
                </span>
                <span className="truncate max-w-[150px]">
                  {currentAction === "deposit"
                    ? selectedToken.symbol
                    : selectedToken.symbol}
                </span>
              </h2>
              <button
                onClick={() => setIsAmountModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Token and Vault Info */}
            <div className="flex items-center justify-between mb-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div className="flex items-center gap-2 max-w-[45%]">
                <img
                  src={selectedToken.icon}
                  alt={selectedToken.symbol}
                  className="w-6 h-6 rounded-full object-cover"
                />
                <span className="font-medium truncate">
                  {selectedToken.symbol}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentAction === "deposit" && (
                  <>
                    <span className="text-gray-500">→</span>
                    <div className="flex items-center gap-2 max-w-[45%]">
                      <img
                        src={activeVault.icon}
                        alt={activeVault.vaultSymbol}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <span className="font-medium truncate">
                        {activeVault.vaultSymbol}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-5">
              <div className="relative mb-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={depositAmount}
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1");
                    if (!isNaN(Number(value))) {
                      setDepositAmount(value);
                    }
                  }}
                  placeholder="0.0"
                  className="w-full p-4 pr-24 text-lg border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
                  <button
                    onClick={() => {
                      // Set max amount based on the current action
                      if (currentAction === "deposit" && selectedToken) {
                        const balance = new BigNumber(
                          selectedToken.rawBalance || "0",
                        )
                          .div(new BigNumber(10).pow(selectedToken.decimals))
                          .toString();
                        setDepositAmount(balance);
                      } else if (currentAction === "withdraw") {
                        const vaultBalance = getVaultBalance(selectedVault);
                        if (vaultBalance) {
                          const balance = new BigNumber(
                            vaultBalance.rawBalance || "0",
                          )
                            .div(new BigNumber(10).pow(vaultBalance.decimals))
                            .toString();
                          setDepositAmount(balance);
                        }
                      }
                    }}
                    className="text-sm text-purple-600 font-medium px-2 py-1 hover:bg-purple-50 dark:hover:bg-gray-600 rounded"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Available Balance */}
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                <span className="mr-1">Available:</span>
                <span className="font-medium">
                  {currentAction === "deposit"
                    ? formatBalance(selectedToken?.balance || "0")
                    : formatBalance(
                        getVaultBalance(selectedVault)?.balance || "0",
                      )}
                </span>
                <span className="ml-1 truncate">
                  {currentAction === "deposit"
                    ? selectedToken?.symbol
                    : activeVault.vaultSymbol}
                </span>
              </div>
            </div>

            {/* Confirm Button */}
            <Button
              onClick={handleAmountConfirm}
              disabled={!depositAmount || parseFloat(depositAmount) <= 0}
              className="w-full"
            >
              {currentAction === "deposit" ? "Deposit" : "Withdraw"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
