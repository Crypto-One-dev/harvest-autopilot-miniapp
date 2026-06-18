import React, { useState, useEffect, useCallback } from "react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "../Button";
import { RevertModalProps } from "~/types";
import { usePortals } from "~/providers/Portals";
import { formatBalance, truncateAddress, parseTokenUnits } from "~/utilities/parsers";
import BigNumber from "bignumber.js";

export default function RevertModal({
  chainId,
  isOpen,
  onClose,
  selectedToken,
  withdrawAmount,
  selectedVault,
  onSuccess,
  walletAddress,
  handleWalletInteraction,
}: RevertModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [isApproveLoading, setIsApproveLoading] = useState(false);
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [estimatedOutput, setEstimatedOutput] = useState<string | null>(null);
  const [analyticsSent, setAnalyticsSent] = useState(false);

  const { portalsApprove, getPortals, getPortalsApproval, getPortalsEstimate } =
    usePortals();
  const sendTransaction = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

  const checkApproval = useCallback(async () => {
    if (!walletAddress || !selectedVault.vaultAddress) return;

    try {
      // Ensure withdrawAmount is a valid number string before parsing
      const safeWithdrawAmount = new BigNumber(
        withdrawAmount || "0",
      ).toString();

      const value = parseTokenUnits(safeWithdrawAmount, selectedVault.vaultDecimals);

      const approval = await getPortalsApproval(
        chainId,
        walletAddress,
        selectedVault.vaultAddress,
      );
      const allowance = approval ? approval.allowance : "0";

      // Check if current allowance is sufficient
      const needsApprove = !new BigNumber(allowance.toString()).gte(
        new BigNumber(value.toString()),
      );
      setNeedsApproval(needsApprove);

      // Move to next step if we don't need approval
      if (!needsApprove) {
        setCurrentStep(1);
      } else {
        setCurrentStep(0); // Ensure we stay on approval step if approval is needed
      }
    } catch (err) {
      console.error("Error checking approval:", err);
      setError("Failed to check vault token approval. Please try again.");
      setCurrentStep(0); // Reset to approval step on error
    }
  }, [
    walletAddress,
    selectedVault.vaultAddress,
    withdrawAmount,
    selectedVault.vaultDecimals,
    chainId,
    getPortalsApproval,
  ]);

  // Fetch estimated output amount
  useEffect(() => {
    const fetchEstimate = async () => {
      // Only proceed if all values are available
      if (
        chainId &&
        walletAddress &&
        selectedVault.vaultAddress &&
        selectedToken.address &&
        withdrawAmount &&
        new BigNumber(withdrawAmount).gt(0)
      ) {
        try {
          // Ensure withdrawAmount is a valid number string before parsing
          const safeWithdrawAmount = new BigNumber(withdrawAmount).toString();

          const value = parseTokenUnits(
            safeWithdrawAmount,
            selectedVault.vaultDecimals,
          );

          const { res: portalData, succeed } = await getPortalsEstimate({
            chainId,
            sender: walletAddress,
            tokenIn: selectedVault.vaultAddress,
            inputAmount: value.toString(),
            tokenOut: selectedToken.address,
            slippage: 1, // 1% slippage
          });

          if (succeed && portalData?.outputAmount) {
            const outputDecimals = selectedToken.decimals;
            const estimatedAmount = new BigNumber(portalData.outputAmount)
              .div(new BigNumber(10).pow(outputDecimals))
              .toString();
            setEstimatedOutput(estimatedAmount);
          } else {
            setEstimatedOutput(null);
          }
        } catch (error) {
          console.error("Error fetching estimate:", error);
          setEstimatedOutput(null);
        }
      } else {
        setEstimatedOutput(null);
      }
    };

    fetchEstimate();
  }, [
    chainId,
    walletAddress,
    selectedVault.vaultAddress,
    selectedToken.address,
    selectedToken.decimals,
    withdrawAmount,
    selectedVault.vaultDecimals,
    getPortalsEstimate,
  ]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && txHash) {
      if (isWaitingForApproval) {
        console.log("Transaction confirmed, updating state directly");
        setIsWaitingForApproval(false);
        // When approval is confirmed, immediately check if we need further approval
        if (currentStep === 0) {
          checkApproval(); // This will set the correct step based on approval status
        }
      }

      // If we're at step 2, update balances and analytics
      if (currentStep === 2 && !analyticsSent) {
        // Only send analytics if transaction is successful and not sent before
        setAnalyticsSent(true); // Mark analytics as sent

        // Log analytics for revert action
        fetch("/api/analytics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "revert",
            tokenSymbol: selectedToken.symbol,
            tokenAddress: selectedToken.address,
            amount: withdrawAmount,
            vaultSymbol: selectedVault.vaultSymbol,
            vaultAddress: selectedVault.vaultAddress,
            txHash: txHash,
            chainId: chainId,
            walletAddress: walletAddress,
          }),
        }).catch(console.error); // Handle error silently
        // Don't need to keep the withdraw loading state anymore
        setIsWithdrawLoading(false);
      }
    }
  }, [
    isConfirmed,
    isWaitingForApproval,
    currentStep,
    selectedToken,
    withdrawAmount,
    selectedVault,
    txHash,
    chainId,
    walletAddress,
    checkApproval,
    analyticsSent,
    onSuccess,
  ]);

  // Check approval when modal opens
  useEffect(() => {
    if (isOpen) {
      checkApproval();
    }
  }, [isOpen, checkApproval]);

  // Add a polling mechanism to recheck approval status after a transaction
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    // When an approval transaction is confirmed, check approval status multiple times
    if (isConfirmed && isWaitingForApproval && currentStep === 0) {
      // Set up polling to check approval status
      let checkCount = 0;

      const recheckApproval = () => {
        checkCount++;

        checkApproval().then(() => {
          // If we still need approval after 5 checks, stop checking
          if (checkCount >= 5) {
            if (timerId) clearInterval(timerId);
            // Force move to next step if we've checked 5 times
            setNeedsApproval(false);
            setCurrentStep(1);
            setIsWaitingForApproval(false);
          }
        });
      };

      // Check immediately and then every 3 seconds
      recheckApproval();
      timerId = setInterval(recheckApproval, 3000);
    }

    // Clean up interval
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isConfirmed, isWaitingForApproval, currentStep, checkApproval]);

  // Check if approval is needed when dependencies change
  useEffect(() => {
    checkApproval();
  }, [
    walletAddress,
    selectedVault.vaultAddress,
    withdrawAmount,
    selectedToken.decimals,
    chainId,
    checkApproval,
  ]);

  const handleApprove = async () => {
    if (!walletAddress || !selectedVault.vaultAddress) return;

    if (isConfirmed && txHash && !isWaitingForApproval) {
      setNeedsApproval(false);
      setCurrentStep(1);
      return;
    }

    await handleWalletInteraction(async () => {
      try {
        setIsApproveLoading(true);
        setError(null);
        setIsWaitingForApproval(true);

        // Ensure withdrawAmount is a valid number string before parsing
        const safeWithdrawAmount = new BigNumber(
          withdrawAmount || "0",
        ).toString();

        const value = parseTokenUnits(
          safeWithdrawAmount,
          selectedVault.vaultDecimals,
        );

        const approvalData = await portalsApprove(
          chainId,
          walletAddress,
          selectedVault.vaultAddress,
          value.toString(),
        );
        if (!approvalData?.approve) {
          throw new Error("Failed to get approval data from Portals");
        }

        const hash = await sendTransaction.mutateAsync({
          to: approvalData.approve.to as `0x${string}`,
          data: approvalData.approve.data as `0x${string}`,
        });

        setTxHash(hash as `0x${string}`);

        // Explicitly update both states together
        setNeedsApproval(false);
        setCurrentStep(1);

        // eslint-disable-line @typescript-eslint/no-explicit-any
      } catch (error: unknown) {
        console.error("Approval error:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to approve vault token. Please try again.";

        setError(message);
        setIsWaitingForApproval(false);
        setCurrentStep(0); // Reset to approval step on error
      } finally {
        setIsApproveLoading(false);
      }
    });
  };

  const handleWithdraw = async () => {
    if (!walletAddress || !selectedVault.vaultAddress || !selectedToken.address)
      return;

    await handleWalletInteraction(async () => {
      try {
        setIsWithdrawLoading(true);
        setError(null);

        // Ensure withdrawAmount is a valid number string before parsing
        const safeWithdrawAmount = new BigNumber(
          withdrawAmount || "0",
        ).toString();

        const value = parseTokenUnits(
          safeWithdrawAmount,
          selectedVault.vaultDecimals,
        );

        const portalData = await getPortals({
          chainId,
          sender: walletAddress,
          tokenIn: selectedVault.vaultAddress as string,
          inputAmount: value.toString(),
          tokenOut: selectedToken.address as string,
          slippage: null,
        });

        if (!portalData?.tx) {
          throw new Error("Failed to get portal data from Portals");
        }

        const hash = await sendTransaction.mutateAsync({
          to: portalData.tx.to as `0x${string}`,
          data: portalData.tx.data as `0x${string}`,
          value: portalData.tx.value ? BigInt(portalData.tx.value) : BigInt(0),
        });

        setTxHash(hash as `0x${string}`);
        setCurrentStep(2);
        // eslint-disable-line @typescript-eslint/no-explicit-any
      } catch (error: unknown) {
        console.error("Withdraw error:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to revert tokens. Please try again.";

        setError(message);
      } finally {
        setIsWithdrawLoading(false);
      }
    });
  };

  const handleClose = () => {
    if (
      isWaitingForApproval ||
      isApproveLoading ||
      isWithdrawLoading ||
      isConfirming
    ) {
      return; // Prevent closing while transactions are in progress
    }
    // Reset all state when closing
    setTxHash(null);
    setCurrentStep(0);
    setError(null);
    setNeedsApproval(true);
    setIsWaitingForApproval(false);
    setAnalyticsSent(false);
    if (currentStep === 2) {
      onSuccess?.();
    } else {
      onClose();
    }
  };

  if (!isOpen) {
    // Clean up state when modal is not open
    if (txHash) setTxHash(null);
    return null;
  }

  const isTransactionInProgress =
    isWaitingForApproval ||
    isApproveLoading ||
    isWithdrawLoading ||
    isConfirming;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pl-2 pr-2">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg p-6 w-[400px] max-w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="revert-modal-title"
        aria-describedby="revert-modal-description"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="revert-modal-title" className="text-xl font-bold">
            Withdraw to {selectedToken.symbol}
          </h2>
          <button
            onClick={handleClose}
            disabled={isTransactionInProgress}
            className={`text-gray-500 hover:text-gray-700 ${isTransactionInProgress ? "cursor-not-allowed opacity-50" : ""}`}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div id="revert-modal-description" className="sr-only">
          Withdraw {selectedVault.vaultSymbol} tokens to {selectedToken.symbol}.
          This process may require approval before withdrawal.
        </div>

        {/* Progress Steps */}
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
            <span className={currentStep > 0 ? "text-gray-400" : ""}>
              {needsApproval
                ? isWaitingForApproval
                  ? "Approving..."
                  : "Approve"
                : "Approved"}
            </span>
            <span>Withdraw</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          {/* Input Amount (Vault Token) */}
          <div className="flex justify-between mb-4">
            <span className="text-gray-600 dark:text-gray-300">
              You Withdraw
            </span>
            <div className="text-right">
              <div className="text-green-600 dark:text-green-400 font-medium">
                {formatBalance(withdrawAmount)} {selectedVault.vaultSymbol}
              </div>
            </div>
          </div>

          {/* Estimated Output Amount - Show always since we're using getPortalsEstimate */}
          <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
            <span className="text-gray-600 dark:text-gray-300">
              You Receive (estimated)
            </span>
            <div className="text-right">
              <div className="text-green-600 dark:text-green-400 font-medium">
                {estimatedOutput
                  ? `${formatBalance(estimatedOutput)} ${selectedToken.symbol}`
                  : "Calculating..."}
              </div>
            </div>
          </div>

          {/* Transaction Hash Display */}
          {txHash && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                Transaction Hash:
              </div>
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-sm font-mono bg-gray-100 dark:bg-gray-600 p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors text-purple-600 dark:text-purple-400"
              >
                {truncateAddress(txHash)}
              </a>
            </div>
          )}
        </div>

        {/* Error Message */}
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

        {/* Action Button */}
        <Button
          onClick={
            currentStep === 0 && needsApproval
              ? handleApprove
              : currentStep === 1 || (currentStep === 0 && !needsApproval)
                ? handleWithdraw
                : handleClose
          }
          disabled={isTransactionInProgress}
          isLoading={isTransactionInProgress}
          className="w-full relative"
        >
          {currentStep === 0 && needsApproval
            ? "Approve"
            : currentStep === 1 || (currentStep === 0 && !needsApproval)
              ? "Withdraw"
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
