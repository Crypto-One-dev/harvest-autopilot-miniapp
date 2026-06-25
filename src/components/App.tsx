import { useEffect, useState, useCallback, useRef } from "react";
import Head from "next/head";
import type { JSX } from "react";
import BigNumber from "bignumber.js";
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
import type { TokenInfo, VaultInfo, Token } from "~/types";
import { usePortals } from "~/providers/Portals";
import {
  adjustVaultShareBalance,
  adjustWalletTokenBalance,
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
        if (balances === null) {
          return null;
        }

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
        console.warn("Failed to fetch balances:", error);
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

  const refreshBalancesAfterTx = useCallback(async () => {
    const retryDelaysMs = [3000, 5000, 8000, 12000];
    let latest: Awaited<ReturnType<typeof fetchBalances>> = null;

    for (const delayMs of retryDelaysMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const balances = await fetchBalances(true);
      if (balances !== null) {
        latest = balances;
      }
    }

    return latest;
  }, [fetchBalances]);

  const replaceTokenInList = useCallback(
    (list: TokenInfo[], updated: TokenInfo): TokenInfo[] => {
      const address = updated.address?.toLowerCase();
      if (!address) return list;

      let found = false;
      const next = list.map((token) => {
        if (token.address?.toLowerCase() === address) {
          found = true;
          return updated;
        }
        return token;
      });

      return found ? next : [...next, updated];
    },
    [],
  );

  const applyOptimisticBalances = useCallback(
    (txAmount: number, tab: VaultTab, token: TokenInfo) => {
      const vault = activeVault;
      if (!vault || !Number.isFinite(txAmount) || txAmount <= 0) return;

      const vaultData = vaultsData?.[vault.id] ?? null;
      const tokenDirection = tab === "exit" ? "add" : "remove";
      const vaultDirection = tab === "exit" ? "remove" : "add";
      const isSameAsset =
        token.address?.toLowerCase() === vault.address.toLowerCase();

      if (tab === "exit" || isSameAsset) {
        setVaultBalances((prev) => {
          const current = prev[vault.symbol];
          if (!current) return prev;
          return {
            ...prev,
            [vault.symbol]: adjustVaultShareBalance(
              current,
              vault,
              vaultData,
              txAmount,
              vaultDirection,
            ),
          };
        });
      }

      const updatedToken = adjustWalletTokenBalance(
        token,
        txAmount,
        tokenDirection,
      );
      setSelectedToken(updatedToken);
      setTokenBalances((tokens) => replaceTokenInList(tokens, updatedToken));
      setSupportedTokens((tokens) => replaceTokenInList(tokens, updatedToken));
    },
    [activeVault, vaultsData, replaceTokenInList],
  );

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

  const handleDetailSuccess = useCallback(async () => {
    const txAmount = parseFloat(depositAmount);
    const tab = detailTab;

    applyOptimisticBalances(txAmount, tab, selectedToken);
    setDepositAmount("");

    const updatedBalances = await refreshBalancesAfterTx();

    if (!updatedBalances?.length || !selectedToken.address) return;

    if (tab === "enter") {
      const currentToken = updatedBalances.find(
        (b) =>
          b.address &&
          b.address.toLowerCase() === selectedToken.address!.toLowerCase(),
      );

      if (currentToken) {
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
      return;
    }

    if (tab === "exit") {
      const receiveToken = updatedBalances.find(
        (b) =>
          b.address &&
          b.address.toLowerCase() === selectedToken.address!.toLowerCase(),
      );

      if (receiveToken) {
        setSelectedToken(mapPortalsBalanceToTokenInfo(receiveToken));
      }
    }
  }, [
    depositAmount,
    detailTab,
    applyOptimisticBalances,
    refreshBalancesAfterTx,
    selectedToken,
    vaultAddress,
    mapPortalsBalanceToTokenInfo,
  ]);

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
              chainId={chainId}
              selectedToken={selectedToken}
              depositAmount={depositAmount}
              withdrawShareAmount={toWithdrawShareAmount(
                depositAmount,
                activeVault,
              )}
              vaultBalance={getVaultBalance(activeVault.symbol)}
              walletAddress={walletAddress}
              isConnected={isWalletConnected}
              isConnecting={connect.isPending}
              onTokenSelect={handleTokenSelect}
              onAmountChange={setDepositAmount}
              onMaxAmount={handleMaxAmount}
              onConnect={handleConnectWallet}
              onNotify={showNotification}
              onSuccess={handleDetailSuccess}
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

    </>
  );
}
