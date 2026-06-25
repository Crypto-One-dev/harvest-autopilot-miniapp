import { useEffect, useState, useCallback, useRef } from "react";
import Head from "next/head";
import type { JSX } from "react";
import BigNumber from "bignumber.js";
import { Button } from "~/components/Button";
import AppShell from "~/components/layout/AppShell";
import VaultList from "~/components/home/VaultList";
import VaultDetail from "~/components/vault/VaultDetail";
import type { VaultTab } from "~/components/vault/VaultDetail";
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
import { formatBalance } from "~/utilities/parsers";
import {
  getSharePriceFromVaultData,
  getVaultUnderlyingBalance,
  underlyingToShares,
} from "~/utilities/vaultBalances";
import { useVaultsData } from "~/hooks/useVaultsData";

import { SUPPORTED_VAULTS, FALLBACK_TOKEN_ICON } from "~/constants";

export default function App(): JSX.Element {
  const { vaultsData, loading: vaultsLoading } = useVaultsData();
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
  const [depositAmount, setDepositAmount] = useState<string>("");
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
  const [notification, setNotification] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null);
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<"deposit" | "withdraw">(
    "deposit",
  );
  const [view, setView] = useState<"home" | "detail">("home");
  const [detailTab, setDetailTab] = useState<VaultTab>("enter");
  const [pendingTokenSelectOpen, setPendingTokenSelectOpen] = useState(false);
  const balanceFetchInFlight = useRef(false);

  const toWithdrawShareAmount = useCallback(
    (underlyingAmount: string, vault: VaultInfo): string => {
      const sharePrice = getSharePriceFromVaultData(
        vaultsData?.[vault.id],
        vault.decimals,
      );
      const underlying = parseFloat(underlyingAmount);
      if (!Number.isFinite(underlying) || underlying <= 0) {
        return underlyingAmount;
      }
      return underlyingToShares(underlying, sharePrice).toString();
    },
    [vaultsData],
  );

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
    if (isWalletConnected && connectedChainId && connectedChainId !== base.id) {
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

  // Add token symbol normalization
  const normalizeTokenSymbol = (symbol: string) => {
    const symbolMap: { [key: string]: string } = {
      CBBTC: "cbBTC",
    };
    return symbolMap[symbol] || symbol;
  };

  const mapPortalsBalanceToTokenInfo = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (balance: any): TokenInfo => {
      const normalizedBalance = new BigNumber(balance.balance || "0");
      const price =
        balance.price ??
        (normalizedBalance.gt(0)
          ? new BigNumber(balance.balanceUSD || "0")
              .div(normalizedBalance)
              .toString()
          : "0");

      return {
        symbol: normalizeTokenSymbol(balance.symbol),
        name: balance.name,
        id: `${normalizeTokenSymbol(balance.symbol).toLowerCase()}_${chainId}`,
        icon: balance.image || balance.images?.[0] || FALLBACK_TOKEN_ICON,
        address: balance.address as `0x${string}`,
        decimals: balance.decimals,
        balance: balance.balance.toString(),
        balanceUSD: balance.balanceUSD?.toString() ?? "0",
        price,
        images: balance.images,
        rawBalance: balance.rawBalance?.toString() ?? "0",
      };
    },
    [chainId],
  );

  // Fetch balances function
  const fetchBalances = useCallback(
    async (force = false) => {
      if (balanceFetchInFlight.current && !force) {
        return null;
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
        return null;
      }

      balanceFetchInFlight.current = true;

      try {
        const balances = await getPortalsBalances(walletAddress, chainId);

        const defaultTokens = SUPPORTED_VAULTS.map((token) => ({
          ...token,
          balance: "0",
          balanceUSD: "0",
          price: "0",
        })) as TokenInfo[];

        const newVaultBalances: { [key: string]: TokenInfo | null } = {};
        const tokensWithBalance: TokenInfo[] = [];

        if (balances && balances.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          balances.forEach((balance: any) => {
            const tokenAddress = balance.address?.toLowerCase();
            const matchingVault = SUPPORTED_VAULTS.find(
              (vault) => vault.vaultAddress?.toLowerCase() === tokenAddress,
            );
            const tokenInfo = mapPortalsBalanceToTokenInfo(balance);

            if (matchingVault) {
              newVaultBalances[matchingVault.symbol] = tokenInfo;
            } else if (Number(balance.balance) > 0) {
              tokensWithBalance.push(tokenInfo);
            }
          });

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

        const tokens = await getPortalsBaseTokens(chainId);
        if (tokens) {
          const balanceList = balances ?? [];
          const tokenInfos = tokens.map((token: Token) => {
            const balanceInfo = balanceList.find(
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
                    .div(new BigNumber(balanceInfo.balance || "1"))
                    .toString()
                : "0",
              images: token.images,
              rawBalance: balanceInfo ? balanceInfo.rawBalance.toString() : "0",
            };
          });
          setSupportedTokens(tokenInfos);
        }

        return balances;
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
        return null;
      } finally {
        balanceFetchInFlight.current = false;
      }
    },
    [
      walletAddress,
      chainId,
      getPortalsBalances,
      getPortalsBaseTokens,
      mapPortalsBalanceToTokenInfo,
    ],
  );

  const refreshBalancesWithRetry = useCallback(async () => {
    const first = await fetchBalances(true);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const second = await fetchBalances(true);
    return second ?? first;
  }, [fetchBalances]);

  useEffect(() => {
    if (!isWalletConnected || !pendingTokenSelectOpen) return;

    if (currentAction === "deposit") {
      setIsConvertTokenModalOpen(true);
    } else {
      setIsRevertTokenModalOpen(true);
    }
    setPendingTokenSelectOpen(false);
  }, [isWalletConnected, pendingTokenSelectOpen, currentAction]);

  // Fetch balances when wallet connects or chain changes
  useEffect(() => {
    if (walletAddress && chainId) {
      void fetchBalances();
    }
  }, [walletAddress, chainId, fetchBalances]);

  // Update the success handlers
  const handleConvertSuccess = async () => {
    setIsConvertModalOpen(false);
    setIsAmountModalOpen(false);
    setDepositAmount("");
    const updatedBalances = await refreshBalancesWithRetry();

    if (!updatedBalances || !selectedToken.address) return;

    const currentToken = updatedBalances.find(
      (b) =>
        b.address &&
        b.address.toLowerCase() === selectedToken.address!.toLowerCase(),
    );

    if (currentToken && Number(currentToken.balance) > 0) {
      setSelectedToken(mapPortalsBalanceToTokenInfo(currentToken));
      return;
    }

    const nextToken = updatedBalances.find(
      (b) =>
        b.address &&
        Number(b.balance) > 0 &&
        b.address.toLowerCase() !== vaultAddress?.toLowerCase(),
    );

    if (nextToken) {
      setSelectedToken(mapPortalsBalanceToTokenInfo(nextToken));
    }
  };

  const handleRevertSuccess = async () => {
    setIsRevertModalOpen(false);
    setIsAmountModalOpen(false);
    setDepositAmount("");
    const updatedBalances = await refreshBalancesWithRetry();

    if (!updatedBalances || !selectedToken.address) return;

    const receiveToken = updatedBalances.find(
      (b) =>
        b.address &&
        b.address.toLowerCase() === selectedToken.address!.toLowerCase(),
    );

    if (receiveToken) {
      setSelectedToken(mapPortalsBalanceToTokenInfo(receiveToken));
    }
  };

  useEffect(() => {
    if (!isWalletConnected || !selectedToken.address) return;

    const tokenAddress = selectedToken.address.toLowerCase();
    const fresh =
      tokenBalances.find((t) => t.address?.toLowerCase() === tokenAddress) ??
      supportedTokens.find((t) => t.address?.toLowerCase() === tokenAddress);

    if (!fresh) return;

    setSelectedToken((prev) => {
      if (
        prev.balance === fresh.balance &&
        prev.rawBalance === fresh.rawBalance
      ) {
        return prev;
      }
      return fresh;
    });
  }, [
    tokenBalances,
    supportedTokens,
    isWalletConnected,
    selectedToken.address,
  ]);

  const getDepositTokenOptions = (vault: VaultInfo): TokenInfo[] => {
    const defaultToken = getDefaultTokenForVault(vault);

    if (!isWalletConnected) {
      return [defaultToken];
    }

    const withBalance = [
      ...tokenBalances.filter((t) => Number(t.balance) > 0),
      ...Object.entries(vaultBalances)
        .filter(
          ([symbol, vaultToken]) =>
            symbol !== vault.symbol &&
            vaultToken !== null &&
            Number(vaultToken.balance) > 0,
        )
        .map(([_, vaultToken]) => vaultToken as TokenInfo),
    ];

    const seen = new Set<string>();
    const unique = withBalance.filter((token) => {
      const key = token.address?.toLowerCase() ?? token.symbol;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      return [defaultToken];
    }

    const hasDefault = unique.some(
      (token) =>
        token.address?.toLowerCase() === defaultToken.address?.toLowerCase(),
    );

    const sorted = unique.sort(
      (a, b) => Number(b.balanceUSD) - Number(a.balanceUSD),
    );

    return hasDefault ? sorted : [defaultToken, ...sorted];
  };

  const getWithdrawTokenOptions = (vault: VaultInfo): TokenInfo[] => {
    const defaultToken =
      supportedTokens.find((t) => t.symbol === vault.symbol) ??
      getDefaultTokenForVault(vault);

    if (!isWalletConnected) {
      return [defaultToken];
    }

    const supportedAddresses = Object.values(
      SUPPORTED_TOKEN_LIST[chainId as keyof typeof SUPPORTED_TOKEN_LIST] || {},
    ).map((addr) => addr.toLowerCase());

    const options = [
      ...supportedTokens.filter((token) => {
        if (!token.address) return false;
        const isBaseToken =
          token.address.toLowerCase() === vault.address.toLowerCase();
        const isInSupportedList = supportedAddresses.includes(
          token.address.toLowerCase(),
        );
        return isBaseToken || isInSupportedList;
      }),
      ...Object.entries(vaultBalances)
        .filter(
          ([symbol, vaultToken]) =>
            symbol !== vault.symbol &&
            vaultToken !== null &&
            Number(vaultToken.balance) > 0,
        )
        .map(([_, vaultToken]) => vaultToken as TokenInfo),
    ];

    const seen = new Set<string>();
    const unique = options.filter((token) => {
      const key = token.address?.toLowerCase() ?? token.symbol;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      return [defaultToken];
    }

    return unique.sort((a, b) => Number(b.balanceUSD) - Number(a.balanceUSD));
  };

  const getDefaultTokenForVault = (vault: VaultInfo): TokenInfo => ({
    symbol: vault.symbol === "WETH" ? "ETH" : vault.symbol,
    name: vault.symbol === "WETH" ? "Ethereum" : vault.name,
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

  const resolveWalletToken = (vault: VaultInfo): TokenInfo => {
    const matchBySymbol = (token: TokenInfo) =>
      token.symbol === vault.symbol ||
      (vault.symbol === "WETH" &&
        (token.symbol === "ETH" || token.symbol === "WETH"));

    return (
      tokenBalances.find(matchBySymbol) ??
      supportedTokens.find(matchBySymbol) ??
      getDefaultTokenForVault(vault)
    );
  };

  const openVaultDetail = (vault: VaultInfo, tab: VaultTab = "enter") => {
    setSelectedVault(vault.symbol);
    setVaultAddress(vault.vaultAddress);
    setActiveVault(vault);
    setDetailTab(tab);
    setDepositAmount("");
    setCurrentAction(tab === "exit" ? "withdraw" : "deposit");

    if (tab === "exit") {
      const defaultToken =
        supportedTokens.find((t) => t.symbol === vault.symbol) ??
        getDefaultTokenForVault(vault);
      setSelectedToken(defaultToken);
    } else {
      setSelectedToken(resolveWalletToken(vault));
    }
    setView("detail");
  };

  // Handle deposit from vault card
  const handleDepositClick = (vault: VaultInfo) => {
    openVaultDetail(vault, "enter");
  };

  const handleDetailTabChange = (tab: VaultTab) => {
    setDetailTab(tab);
    setDepositAmount("");

    if (tab === "enter") {
      setCurrentAction("deposit");
      if (activeVault) {
        setSelectedToken(resolveWalletToken(activeVault));
      }
      return;
    }

    if (tab === "exit") {
      setCurrentAction("withdraw");
      if (activeVault) {
        const defaultToken =
          supportedTokens.find((t) => t.symbol === activeVault.symbol) ??
          getDefaultTokenForVault(activeVault);
        setSelectedToken(defaultToken);
      }
    }
  };

  const handleTokenSelect = () => {
    if (!isWalletConnected) {
      setPendingTokenSelectOpen(true);
      handleConnectWallet();
      return;
    }

    if (currentAction === "deposit") {
      setIsConvertTokenModalOpen(true);
    } else {
      setIsRevertTokenModalOpen(true);
    }
  };

  const handleMaxAmount = () => {
    if (currentAction === "deposit" && selectedToken) {
      const balance = new BigNumber(selectedToken.rawBalance || "0")
        .div(new BigNumber(10).pow(selectedToken.decimals))
        .toString();
      setDepositAmount(balance);
      return;
    }

    const vaultBalance = getVaultBalance(selectedVault);
    const vault =
      activeVault ?? SUPPORTED_VAULTS.find((v) => v.symbol === selectedVault);
    if (vaultBalance && vault) {
      const { underlying } = getVaultUnderlyingBalance(
        vaultBalance,
        vaultsData?.[vault.id],
        vault.decimals,
      );
      setDepositAmount(underlying.toString());
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
      const vault =
        activeVault ?? SUPPORTED_VAULTS.find((v) => v.symbol === selectedVault);
      if (vaultBalance && vault) {
        const { underlying } = getVaultUnderlyingBalance(
          vaultBalance,
          vaultsData?.[vault.id],
          vault.decimals,
        );

        if (new BigNumber(depositAmount).gt(underlying)) {
          showNotification(
            `Insufficient ${vault.symbol} balance. Available: ${formatBalance(underlying.toString())}`,
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

  const handleHoldingsSubmit = () => {
    if (!isWalletConnected) {
      handleConnectWallet();
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    if (currentAction === "deposit") {
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

      setIsConvertModalOpen(true);
      return;
    }

    const vaultBalance = getVaultBalance(selectedVault);
    const vault =
      activeVault ?? SUPPORTED_VAULTS.find((v) => v.symbol === selectedVault);
    if (vaultBalance && vault) {
      const { underlying } = getVaultUnderlyingBalance(
        vaultBalance,
        vaultsData?.[vault.id],
        vault.decimals,
      );

      if (new BigNumber(depositAmount).gt(underlying)) {
        showNotification(
          `Insufficient ${vault.symbol} balance. Available: ${formatBalance(underlying.toString())}`,
          "error",
        );
        return;
      }
    } else {
      showNotification("You don't have a vault balance to withdraw", "error");
      return;
    }

    setIsRevertModalOpen(true);
  };

  const handleConnectWallet = () => {
    const connector: Connector | undefined =
      connectors.find((c: Connector) => c.id === "baseAccount") ??
      connectors.find((c: Connector) => c.id === "injected") ??
      connectors[0];
    if (connector) {
      connect.mutate({ connector });
    }
  };

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </Head>
      <AppShell onBrandClick={() => setView("home")}>
        {notification && (
          <div
            className={`harvest-toast ${
              notification.type === "error" ? "is-error" : "is-success"
            }`}
          >
            <p style={{ margin: 0, fontSize: 13 }}>{notification.message}</p>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="harvest-modal-close"
            >
              ✕
            </button>
          </div>
        )}

        {view === "home" ? (
          <VaultList
            vaultsData={vaultsData}
            vaultsLoading={vaultsLoading}
            onSelectVault={handleDepositClick}
          />
        ) : (
          activeVault && (
            <VaultDetail
              vault={activeVault}
              vaultsData={vaultsData}
              vaultsLoading={vaultsLoading}
              activeTab={detailTab}
              onTabChange={handleDetailTabChange}
              onBack={() => setView("home")}
              selectedToken={selectedToken}
              depositAmount={depositAmount}
              vaultBalance={getVaultBalance(activeVault.symbol)}
              walletAddress={walletAddress}
              isConnected={isWalletConnected}
              isConnecting={connect.isPending}
              onTokenSelect={handleTokenSelect}
              onAmountChange={setDepositAmount}
              onMaxAmount={handleMaxAmount}
              onSubmit={handleHoldingsSubmit}
            />
          )
        )}
      </AppShell>

      {/* Token Selection Modals */}
      {isConvertTokenModalOpen &&
        activeVault &&
        currentAction === "deposit" && (
          <ConvertTokenSelectModal
            isOpen={isConvertTokenModalOpen}
            onClose={() => setIsConvertTokenModalOpen(false)}
            onSelect={(token: TokenInfo) => {
              setSelectedToken(token);
              setIsConvertTokenModalOpen(false);
            }}
            selectedToken={selectedToken}
            tokens={getDepositTokenOptions(activeVault)}
          />
        )}

      {isRevertTokenModalOpen &&
        activeVault &&
        currentAction === "withdraw" && (
          <RevertTokenSelectModal
            isOpen={isRevertTokenModalOpen}
            onClose={() => setIsRevertTokenModalOpen(false)}
            onSelect={(token: TokenInfo) => {
              setSelectedToken(token);
              setIsRevertTokenModalOpen(false);
            }}
            selectedToken={selectedToken}
            tokens={getWithdrawTokenOptions(activeVault)}
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
          withdrawAmount={toWithdrawShareAmount(depositAmount, activeVault)}
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
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
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
                        const vault =
                          activeVault ??
                          SUPPORTED_VAULTS.find((v) => v.symbol === selectedVault);
                        if (vaultBalance && vault) {
                          const { underlying } = getVaultUnderlyingBalance(
                            vaultBalance,
                            vaultsData?.[vault.id],
                            vault.decimals,
                          );
                          setDepositAmount(underlying.toString());
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
                    : (() => {
                        const vault =
                          activeVault ??
                          SUPPORTED_VAULTS.find((v) => v.symbol === selectedVault);
                        const vaultBalance = getVaultBalance(selectedVault);
                        if (!vault || !vaultBalance) return "0";
                        const { underlying } = getVaultUnderlyingBalance(
                          vaultBalance,
                          vaultsData?.[vault.id],
                          vault.decimals,
                        );
                        return formatBalance(underlying.toString());
                      })()}
                </span>
                <span className="ml-1 truncate">
                  {currentAction === "deposit"
                    ? selectedToken?.symbol
                    : activeVault?.symbol}
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
