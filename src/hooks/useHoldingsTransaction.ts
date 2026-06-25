import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import BigNumber from "bignumber.js";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import type { HoldingsMode } from "~/components/vault/HoldingsPanel";
import { usePortals } from "~/providers/Portals";
import { parseTokenUnits } from "~/utilities/parsers";
import { isNativeEthToken } from "~/utilities/portalsTokens";
import {
  getPortalsWithRetry,
  isPortalsApprovalSufficient,
  isTransferFromFailed,
  type PortalsApprovalContext,
} from "~/utilities/portalsApproval";
import {
  decodeApprovalSpender,
  isOnchainAllowanceSufficient,
} from "~/utilities/onchainAllowance";
import { parseWalletError } from "~/utilities/walletErrors";
import type { TokenInfo, VaultInfo } from "~/types";

type ActiveTx = {
  hash: `0x${string}`;
  kind: "approve" | "execute";
};


function isPortalsPortalError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 400;
}

function isCrossAssetDeposit(
  isDeposit: boolean,
  selectedToken: TokenInfo,
  vault: VaultInfo,
): boolean {
  if (!isDeposit || isNativeEthToken(selectedToken) || !selectedToken.address) {
    return false;
  }
  return selectedToken.address.toLowerCase() !== vault.address.toLowerCase();
}

function notifyTxError(
  error: unknown,
  action: "approve" | "deposit" | "exit",
  onError: (message: string) => void,
  options: { isCrossAsset?: boolean } = {},
): void {
  const message = parseWalletError(error, action, options);
  if (message) {
    onError(message);
  }
}

interface UseHoldingsTransactionParams {
  mode: HoldingsMode;
  chainId: number;
  walletAddress: string | null;
  vault: VaultInfo;
  selectedToken: TokenInfo;
  amount: string;
  shareAmount: string;
  isConnected: boolean;
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
}

export function useHoldingsTransaction({
  mode,
  chainId,
  walletAddress,
  vault,
  selectedToken,
  amount,
  shareAmount,
  isConnected,
  onSuccess,
  onError,
}: UseHoldingsTransactionParams) {
  const isDeposit = mode === "deposit";
  const [activeTx, setActiveTx] = useState<ActiveTx | null>(null);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [isApprovalReady, setIsApprovalReady] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [analyticsSent, setAnalyticsSent] = useState(false);
  const handledApproveHashRef = useRef<string | null>(null);
  const approvalSpenderRef = useRef<`0x${string}` | null>(null);

  const { portalsApprove, getPortals, getPortalsApproval } = usePortals();
  const sendTransaction = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isTxError } =
    useWaitForTransactionReceipt({
      hash: activeTx?.hash,
    });

  const getDepositUnits = useCallback((): string => {
    const safeAmount = new BigNumber(amount || "0").toString();
    return parseTokenUnits(safeAmount, selectedToken.decimals).toString();
  }, [amount, selectedToken.decimals]);

  const getWithdrawUnits = useCallback((): string => {
    const safeAmount = new BigNumber(shareAmount || "0").toString();
    return parseTokenUnits(safeAmount, vault.vaultDecimals).toString();
  }, [shareAmount, vault.vaultDecimals]);

  const getApprovalTokenAddress = useCallback((): `0x${string}` | undefined => {
    return isDeposit ? selectedToken.address : vault.vaultAddress;
  }, [isDeposit, selectedToken.address, vault.vaultAddress]);

  const getRequiredUnits = useCallback((): string => {
    return isDeposit ? getDepositUnits() : getWithdrawUnits();
  }, [isDeposit, getDepositUnits, getWithdrawUnits]);

  const fetchApprovalContext =
    useCallback(async (): Promise<PortalsApprovalContext | null> => {
      const tokenAddress = getApprovalTokenAddress();
      if (!walletAddress || !tokenAddress) return null;

      const context = await getPortalsApproval(
        chainId,
        walletAddress,
        tokenAddress,
        getRequiredUnits(),
      );

      return context ?? null;
    }, [
      walletAddress,
      getApprovalTokenAddress,
      chainId,
      getPortalsApproval,
      getRequiredUnits,
    ]);

  const checkApproval = useCallback(async (): Promise<boolean> => {
    if (!walletAddress || !getApprovalTokenAddress()) return false;

    if (isDeposit && isNativeEthToken(selectedToken)) {
      setNeedsApproval(false);
      setIsApprovalReady(true);
      return true;
    }

    try {
      const requiredAmount = getRequiredUnits();
      const context = await fetchApprovalContext();
      const hasAllowance = isPortalsApprovalSufficient(context, requiredAmount);

      setNeedsApproval(!hasAllowance);
      setIsApprovalReady(hasAllowance);
      return hasAllowance;
    } catch (error) {
      console.error("Error checking approval:", error);
      setNeedsApproval(true);
      setIsApprovalReady(false);
      return false;
    }
  }, [
    walletAddress,
    getApprovalTokenAddress,
    isDeposit,
    selectedToken,
    fetchApprovalContext,
    getRequiredUnits,
  ]);

  /**
   * Polls until the approval is usable, accepting EITHER signal:
   *  - Portals `shouldApprove === false` — authoritative when Portals routes
   *    through Permit2 / a Coinbase Smart Wallet spend-permission, where the
   *    token's own `allowance()` stays 0.
   *  - A sufficient on-chain ERC-20 `allowance()` — authoritative for plain
   *    approvals and beats the Portals indexer lag that caused the wallet to
   *    revert deposits with TRANSFER_FROM_FAILED.
   *
   * Using OR means neither mechanism can falsely block the other.
   */
  const waitUntilApprovalReady = useCallback(
    async (
      options: {
        attempts?: number;
        intervalMs?: number;
        spender?: `0x${string}` | null;
      } = {},
    ): Promise<boolean> => {
      const {
        attempts = 15,
        intervalMs = 2000,
        spender = approvalSpenderRef.current,
      } = options;

      const tokenAddress = getApprovalTokenAddress();
      const requiredAmount = getRequiredUnits();
      if (!walletAddress || !tokenAddress) return false;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const context = await fetchApprovalContext();
        if (isPortalsApprovalSufficient(context, requiredAmount)) {
          setIsApprovalReady(true);
          setNeedsApproval(false);
          return true;
        }

        if (spender) {
          const onchainReady = await isOnchainAllowanceSufficient({
            token: tokenAddress,
            owner: walletAddress as `0x${string}`,
            spender,
            chainId,
            requiredAmount,
          });
          if (onchainReady) {
            setIsApprovalReady(true);
            setNeedsApproval(false);
            return true;
          }
        }

        if (attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }

      setIsApprovalReady(false);
      setNeedsApproval(true);
      return false;
    },
    [
      walletAddress,
      getApprovalTokenAddress,
      getRequiredUnits,
      fetchApprovalContext,
      chainId,
    ],
  );

  useEffect(() => {
    if (!isConnected || !walletAddress || !amount || parseFloat(amount) <= 0) {
      setNeedsApproval(true);
      setIsApprovalReady(false);
      setIsWaitingForApproval(false);
      handledApproveHashRef.current = null;
      return;
    }

    if (isWaitingForApproval) return;

    let cancelled = false;

    async function runCheck() {
      setIsCheckingApproval(true);
      await checkApproval();
      if (!cancelled) {
        setIsCheckingApproval(false);
      }
    }

    void runCheck();
    return () => {
      cancelled = true;
    };
  }, [
    isConnected,
    walletAddress,
    amount,
    shareAmount,
    selectedToken.address,
    vault.vaultAddress,
    mode,
    checkApproval,
    isWaitingForApproval,
  ]);

  useEffect(() => {
    if (!isTxError || !activeTx) return;

    setActiveTx(null);
    setIsWaitingForApproval(false);
    setIsSubmitting(false);
    handledApproveHashRef.current = null;
    onError("Transaction failed on Base. Please try again.");
  }, [isTxError, activeTx, onError]);

  useEffect(() => {
    if (!isConfirmed || !activeTx) return;

    if (activeTx.kind === "approve") {
      if (handledApproveHashRef.current === activeTx.hash) return;
      handledApproveHashRef.current = activeTx.hash;

      setIsWaitingForApproval(true);
      setIsApprovalReady(false);

      void waitUntilApprovalReady().then((ready) => {
        setIsWaitingForApproval(false);
        setActiveTx(null);
        handledApproveHashRef.current = null;
        setNeedsApproval(!ready);
        setIsApprovalReady(ready);

        if (!ready) {
          onError(
            "Approval is still pending. Wait for confirmation on Base, then try again.",
          );
        }
      });
      return;
    }

    if (activeTx.kind === "execute" && !analyticsSent) {
      setAnalyticsSent(true);
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isDeposit ? "convert" : "revert",
          tokenSymbol: selectedToken.symbol,
          tokenAddress: selectedToken.address,
          amount: isDeposit ? amount : shareAmount,
          vaultAddress: vault.vaultAddress,
          vaultSymbol: vault.vaultSymbol,
          txHash: activeTx.hash,
          chainId,
          walletAddress,
        }),
      }).catch(console.error);

      void onSuccess();
      setActiveTx(null);
      setAnalyticsSent(false);
    }
  }, [
    isConfirmed,
    activeTx,
    waitUntilApprovalReady,
    onError,
    analyticsSent,
    isDeposit,
    selectedToken,
    amount,
    shareAmount,
    vault,
    chainId,
    walletAddress,
    onSuccess,
  ]);

  const runApprove = useCallback(async () => {
    const tokenAddress = getApprovalTokenAddress();
    if (!walletAddress || !tokenAddress) return;

    if (isDeposit && isNativeEthToken(selectedToken)) {
      setNeedsApproval(false);
      setIsApprovalReady(true);
      return;
    }

    try {
      setIsSubmitting(true);
      setIsWaitingForApproval(true);
      setIsApprovalReady(false);
      const value = getRequiredUnits();
      const approvalData = await portalsApprove(
        chainId,
        walletAddress as `0x${string}`,
        tokenAddress,
        value,
      );

      if (!approvalData?.approve) {
        const alreadyApproved = await checkApproval();
        if (alreadyApproved) {
          setIsWaitingForApproval(false);
          return;
        }
        throw new Error("Failed to get approval data from Portals");
      }

      approvalSpenderRef.current = decodeApprovalSpender(
        approvalData.approve.data,
      );

      const hash = await sendTransaction.mutateAsync({
        to: approvalData.approve.to as `0x${string}`,
        data: approvalData.approve.data as `0x${string}`,
      });

      if (hash) {
        setActiveTx({ hash, kind: "approve" });
      }
    } catch (error) {
      console.error("Approval error:", error);
      notifyTxError(error, "approve", onError);
      setIsApprovalReady(false);
      setIsWaitingForApproval(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    getApprovalTokenAddress,
    walletAddress,
    isDeposit,
    selectedToken,
    getRequiredUnits,
    portalsApprove,
    chainId,
    checkApproval,
    sendTransaction,
    onError,
  ]);

  const runExecute = useCallback(async () => {
    if (!walletAddress || !selectedToken.address) return;

    try {
      setIsSubmitting(true);

      const requiresApproval = !isDeposit || !isNativeEthToken(selectedToken);
      if (requiresApproval) {
        const ready = await waitUntilApprovalReady();
        if (!ready) {
          onError(
            isDeposit
              ? "Token approval is not active yet. Wait for your approval transaction to confirm on Base, then try Deposit again."
              : "Token approval is not active yet. Wait for your approval transaction to confirm on Base, then try Exit again.",
          );
          setNeedsApproval(true);
          setIsApprovalReady(false);
          return;
        }
      }

      const portalParams = {
        chainId,
        sender: walletAddress,
        tokenIn: (isDeposit
          ? selectedToken.address
          : vault.vaultAddress) as string,
        inputAmount: isDeposit ? getDepositUnits() : getWithdrawUnits(),
        tokenOut: (isDeposit
          ? vault.vaultAddress
          : selectedToken.address) as string,
      };


      let portalData: Awaited<ReturnType<typeof getPortals>> | undefined;

      try {
        portalData = await getPortalsWithRetry(
          () =>
            getPortals({
              ...portalParams,
              slippage: null,
              validate: true,
            }),
          {
            attempts: requiresApproval ? 8 : 4,
            intervalMs: 2500,
            onTransferFromFailed: requiresApproval
              ? async () => {
                  await waitUntilApprovalReady({
                    attempts: 3,
                    intervalMs: 2000,
                    spender: approvalSpenderRef.current,
                  });
                }
              : undefined,
          },
        );
      } catch (error) {
        if (requiresApproval && isTransferFromFailed(error)) {
          portalData = await getPortals({
            ...portalParams,
            validate: false,
          });
        } else {
          throw error;
        }
      }

      if (!portalData?.tx) {
        throw new Error("Failed to get portal data from Portals");
      }

      // Final gate: confirm the approval is actually usable before handing the
      // wallet a tx that could revert with TRANSFER_FROM_FAILED. Accepts either
      // the on-chain allowance (plain ERC-20) or Portals readiness (Permit2 /
      // smart-wallet spend-permission), so neither path false-blocks the other.
      if (requiresApproval) {
        const spender =
          (portalData.tx.to as `0x${string}`) ?? approvalSpenderRef.current;
        const allowanceLive = await waitUntilApprovalReady({
          attempts: 8,
          intervalMs: 2000,
          spender,
        });

        if (!allowanceLive) {
          onError(
            isDeposit
              ? "Approval hasn't landed on Base yet. Give it a few seconds, then tap Deposit again."
              : "Approval hasn't landed on Base yet. Give it a few seconds, then tap Exit again.",
          );
          setNeedsApproval(true);
          setIsApprovalReady(false);
          return;
        }
      }

      const hash = await sendTransaction.mutateAsync({
        to: portalData.tx.to as `0x${string}`,
        data: portalData.tx.data as `0x${string}`,
        value: portalData.tx.value ? BigInt(portalData.tx.value) : BigInt(0),
      });

      if (hash) {
        setActiveTx({ hash, kind: "execute" });
      }
    } catch (error) {
      console.error("Transaction error:", error);
      notifyTxError(error, isDeposit ? "deposit" : "exit", onError, {
        isCrossAsset: isCrossAssetDeposit(isDeposit, selectedToken, vault),
      });

      if (isTransferFromFailed(error) || isPortalsPortalError(error)) {
        setIsApprovalReady(false);
        setNeedsApproval(false);
        setIsWaitingForApproval(true);
        void waitUntilApprovalReady().then((ready) => {
          setIsWaitingForApproval(false);
          setIsApprovalReady(ready);
          setNeedsApproval(!ready);
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    walletAddress,
    selectedToken,
    isDeposit,
    vault,
    waitUntilApprovalReady,
    onError,
    getPortals,
    chainId,
    getDepositUnits,
    getWithdrawUnits,
    sendTransaction,
  ]);

  const handleAction = useCallback(async () => {
    if (isWaitingForApproval) return;

    if (needsApproval && !isApprovalReady) {
      await runApprove();
      return;
    }
    await runExecute();
  }, [
    isWaitingForApproval,
    needsApproval,
    isApprovalReady,
    runApprove,
    runExecute,
  ]);

  const isBusy =
    isSubmitting || isConfirming || isCheckingApproval || isWaitingForApproval;

  return {
    needsApproval: needsApproval && !isApprovalReady,
    isBusy,
    isWaitingForApproval,
    isCheckingApproval,
    handleAction,
  };
}
