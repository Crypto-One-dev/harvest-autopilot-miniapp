import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "../Button";
import { ConvertModalProps } from "~/types";
import { usePortals } from "~/providers/Portals";
import {
  formatBalance,
  truncateAddress,
  parseTokenUnits,
} from "~/utilities/parsers";
import { isNativeEthToken } from "~/utilities/portalsTokens";
import {
  getPortalsWithRetry,
  isPortalsApprovalSufficient,
  isTransferFromFailed,
  waitForPortalsApproval,
  type PortalsApprovalContext,
} from "~/utilities/portalsApproval";
import BigNumber from "bignumber.js";
import { SUPPORTED_VAULTS } from "~/constants";

type ActiveTx = {
  hash: `0x${string}`;
  kind: "approve" | "deposit";
};

function parsePortalsError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.message;
    if (typeof apiMessage === "string") {
      if (apiMessage.includes("TRANSFER_FROM_FAILED")) {
        return "Approval is still syncing on Base. Wait a few seconds, then tap Convert again.";
      }
      return apiMessage;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to convert tokens. Please try again.";
}

export default function ConvertModal({
  chainId,
  isOpen,
  onClose,
  selectedToken,
  depositAmount,
  vaultAddress,
  onSuccess,
  walletAddress,
  handleWalletInteraction,
}: ConvertModalProps) {
  const [activeTx, setActiveTx] = useState<ActiveTx | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [isApprovalReady, setIsApprovalReady] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isApproveLoading, setIsApproveLoading] = useState(false);
  const [isDepositLoading, setIsDepositLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [analyticsSent, setAnalyticsSent] = useState(false);

  const { portalsApprove, getPortals, getPortalsApproval } = usePortals();
  const sendTransaction = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: activeTx?.hash,
    });

  const getRequiredAmount = useCallback((): string => {
    const safeDepositAmount = new BigNumber(depositAmount || "0").toString();
    return parseTokenUnits(
      safeDepositAmount,
      selectedToken.decimals,
    ).toString();
  }, [depositAmount, selectedToken.decimals]);

  const fetchApprovalContext =
    useCallback(async (): Promise<PortalsApprovalContext | null> => {
      if (!walletAddress || !selectedToken.address) return null;

      const context = await getPortalsApproval(
        chainId,
        walletAddress,
        selectedToken.address,
        getRequiredAmount(),
      );

      return context ?? null;
    }, [
      walletAddress,
      selectedToken.address,
      chainId,
      getPortalsApproval,
      getRequiredAmount,
    ]);

  const checkApproval = useCallback(async (): Promise<boolean> => {
    if (!walletAddress || !selectedToken.address || !vaultAddress) return false;

    try {
      if (isNativeEthToken(selectedToken)) {
        setNeedsApproval(false);
        setIsApprovalReady(true);
        setCurrentStep(1);
        setIsWaitingForApproval(false);
        return true;
      }

      const requiredAmount = getRequiredAmount();
      const context = await fetchApprovalContext();
      const hasAllowance = isPortalsApprovalSufficient(context, requiredAmount);

      setNeedsApproval(!hasAllowance);
      setIsApprovalReady(hasAllowance);

      if (hasAllowance) {
        setCurrentStep(1);
        setIsWaitingForApproval(false);
      } else {
        setCurrentStep(0);
      }

      return hasAllowance;
    } catch (err) {
      console.error("Error in approval flow:", err);
      setError("Failed to check token approval. Please try again.");
      setNeedsApproval(true);
      setIsApprovalReady(false);
      setCurrentStep(0);
      setIsWaitingForApproval(false);
      return false;
    }
  }, [
    walletAddress,
    selectedToken,
    vaultAddress,
    fetchApprovalContext,
    getRequiredAmount,
  ]);

  const waitUntilApprovalReady = useCallback(async (): Promise<boolean> => {
    const requiredAmount = getRequiredAmount();
    const ready = await waitForPortalsApproval(
      fetchApprovalContext,
      requiredAmount,
      { attempts: 15, intervalMs: 2000 },
    );

    setIsApprovalReady(ready);
    setNeedsApproval(!ready);

    if (ready) {
      setCurrentStep(1);
      setIsWaitingForApproval(false);
      setError(null);
    }

    return ready;
  }, [fetchApprovalContext, getRequiredAmount]);

  useEffect(() => {
    if (!isConfirmed || !activeTx) return;

    if (activeTx.kind === "approve") {
      setIsWaitingForApproval(true);
      void waitUntilApprovalReady().then((ready) => {
        if (!ready) {
          setError(
            "Approval is still pending. Wait for confirmation on Base, then tap Convert again.",
          );
        }
      });
      return;
    }

    if (activeTx.kind === "deposit" && currentStep === 2 && !analyticsSent) {
      const vault = SUPPORTED_VAULTS.find(
        (v) => v.vaultAddress.toLowerCase() === vaultAddress?.toLowerCase(),
      );

      setAnalyticsSent(true);
      fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "convert",
          tokenSymbol: selectedToken.symbol,
          tokenAddress: selectedToken.address,
          amount: depositAmount,
          vaultAddress: vaultAddress,
          vaultSymbol: vault?.vaultSymbol || "",
          txHash: activeTx.hash,
          chainId: chainId,
          walletAddress: walletAddress,
        }),
      }).catch(console.error);
    }
  }, [
    isConfirmed,
    activeTx,
    currentStep,
    selectedToken,
    depositAmount,
    vaultAddress,
    chainId,
    walletAddress,
    waitUntilApprovalReady,
    analyticsSent,
  ]);

  useEffect(() => {
    if (isOpen) {
      void checkApproval();
    }
  }, [isOpen, checkApproval]);

  const handleApprove = async () => {
    if (!walletAddress || !selectedToken.address || !vaultAddress) return;

    if (isNativeEthToken(selectedToken)) {
      setNeedsApproval(false);
      setIsApprovalReady(true);
      setCurrentStep(1);
      setError(null);
      return;
    }

    if (
      activeTx?.kind === "approve" &&
      isConfirmed &&
      !isWaitingForApproval &&
      !needsApproval
    ) {
      return;
    }

    await handleWalletInteraction(async () => {
      try {
        setIsApproveLoading(true);
        setError(null);
        setIsWaitingForApproval(true);
        setIsApprovalReady(false);
        setCurrentStep(0);

        const value = getRequiredAmount();
        const approvalData = await portalsApprove(
          chainId,
          walletAddress,
          selectedToken.address,
          value,
        );

        if (!approvalData?.approve) {
          const alreadyApproved = await checkApproval();
          if (alreadyApproved) {
            return;
          }

          throw new Error("Failed to get approval data from Portals");
        }

        const hash = await sendTransaction.mutateAsync({
          to: approvalData.approve.to as `0x${string}`,
          data: approvalData.approve.data as `0x${string}`,
        });

        if (hash) {
          setActiveTx({ hash, kind: "approve" });
        }
      } catch (error: unknown) {
        console.error("Approval error:", error);
        setError(parsePortalsError(error));
        setIsWaitingForApproval(false);
        setIsApprovalReady(false);
        setCurrentStep(0);
      } finally {
        setIsApproveLoading(false);
      }
    });
  };

  const handleDeposit = async () => {
    if (!walletAddress || !selectedToken.address || !vaultAddress) return;

    const tokenIn = selectedToken.address;

    await handleWalletInteraction(async () => {
      try {
        setIsDepositLoading(true);
        setError(null);

        const value = getRequiredAmount();

        if (!isNativeEthToken(selectedToken)) {
          const ready = isApprovalReady ? true : await waitUntilApprovalReady();

          if (!ready) {
            setError(
              "Token approval is not active yet. Wait for your approval transaction to confirm on Base, then try Convert again.",
            );
            setNeedsApproval(true);
            setCurrentStep(0);
            return;
          }
        }

        const portalData = await getPortalsWithRetry(
          () =>
            getPortals({
              chainId,
              sender: walletAddress,
              tokenIn,
              inputAmount: value,
              tokenOut: vaultAddress,
              slippage: null,
            }),
          { attempts: 8, intervalMs: 2500 },
        );

        if (!portalData?.tx) {
          throw new Error("Failed to get portal data from Portals");
        }

        const hash = await sendTransaction.mutateAsync({
          to: portalData.tx.to as `0x${string}`,
          data: portalData.tx.data as `0x${string}`,
          value: portalData.tx.value ? BigInt(portalData.tx.value) : BigInt(0),
        });

        if (hash) {
          setActiveTx({ hash, kind: "deposit" });
          setCurrentStep(2);
        }
      } catch (error: unknown) {
        console.error("Deposit error:", error);
        const message = parsePortalsError(error);
        setError(message);

        if (isTransferFromFailed(error)) {
          setNeedsApproval(false);
          setIsApprovalReady(false);
          setCurrentStep(1);
          void waitUntilApprovalReady();
        }
      } finally {
        setIsDepositLoading(false);
      }
    });
  };

  const handleClose = () => {
    if (
      isWaitingForApproval ||
      isApproveLoading ||
      isDepositLoading ||
      isConfirming
    ) {
      return;
    }

    setActiveTx(null);
    setCurrentStep(0);
    setError(null);
    setNeedsApproval(true);
    setIsApprovalReady(false);
    setIsWaitingForApproval(false);
    setAnalyticsSent(false);

    if (currentStep === 2) {
      onSuccess?.();
    } else {
      onClose();
    }
    onClose();
  };

  if (!isOpen) {
    if (activeTx) setActiveTx(null);
    return null;
  }

  const isTransactionInProgress =
    isWaitingForApproval ||
    isApproveLoading ||
    isDepositLoading ||
    isConfirming;

  const canConvert =
    currentStep === 1 ||
    (currentStep === 0 && !needsApproval && isApprovalReady);

  return (
    <div
      className="harvest-modal-overlay"
      onClick={isTransactionInProgress ? undefined : handleClose}
    >
      <div
        className="harvest-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-modal-title"
        aria-describedby="convert-modal-description"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2
            id="convert-modal-title"
            className="harvest-modal-title"
            style={{ margin: 0 }}
          >
            Convert {selectedToken.symbol}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isTransactionInProgress}
            className="harvest-modal-close"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div id="convert-modal-description" className="sr-only">
          Convert {selectedToken.symbol} tokens to vault tokens. This process
          may require approval before conversion.
        </div>

        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <div
              className={`flex-1 h-2 rounded-l ${currentStep >= 0 ? "bg-purple-600" : "bg-gray-200"}`}
            />
            <div
              className={`flex-1 h-2 ${currentStep >= 1 ? "bg-purple-600" : "bg-gray-200"}`}
            />
            <div
              className={`flex-1 h-2 rounded-r ${currentStep >= 2 ? "bg-purple-600" : "bg-gray-200"}`}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className={needsApproval ? "" : "text-gray-400"}>
              {needsApproval
                ? isWaitingForApproval
                  ? "Approving..."
                  : "Approve"
                : "Approved"}
            </span>
            <span>
              {canConvert && !isApprovalReady
                ? "Syncing approval..."
                : "Convert"}
            </span>
            <span>Complete</span>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-300">Amount</span>
            <div className="text-right">
              <div className="text-green-600 dark:text-green-400 font-medium">
                {formatBalance(depositAmount)} {selectedToken.symbol}
              </div>
              <div className="text-sm text-gray-500">
                $
                {formatBalance(
                  new BigNumber(depositAmount)
                    .times(selectedToken.price)
                    .toString(),
                )}
              </div>
            </div>
          </div>
          {activeTx && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                Transaction Hash:
              </div>
              <a
                href={`https://basescan.org/tx/${activeTx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-sm font-mono bg-gray-100 dark:bg-gray-600 p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors text-purple-600 dark:text-purple-400"
              >
                {truncateAddress(activeTx.hash)}
              </a>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-6">
            <div
              className="text-sm break-words"
              title={error.length > 300 ? error : undefined}
            >
              {error.length > 300 ? `${error.slice(0, 300)}...` : error}
            </div>
          </div>
        )}

        <Button
          onClick={
            currentStep === 0 && needsApproval
              ? handleApprove
              : canConvert
                ? handleDeposit
                : handleClose
          }
          disabled={
            isTransactionInProgress ||
            (currentStep === 2 && !isConfirmed) ||
            (canConvert && !isApprovalReady) ||
            (currentStep === 0 && isWaitingForApproval)
          }
          isLoading={isTransactionInProgress}
          className="w-full relative"
        >
          {currentStep === 0 && needsApproval
            ? isWaitingForApproval
              ? "Confirming approval..."
              : "Approve"
            : canConvert
              ? isApprovalReady
                ? "Convert"
                : "Syncing approval..."
              : "Complete"}
          {isTransactionInProgress && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
