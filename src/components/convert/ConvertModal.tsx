import React, { useState, useEffect, useCallback } from "react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "../Button";
import { ConvertModalProps } from "~/types";
import { usePortals } from "~/providers/Portals";
import { formatBalance, truncateAddress, parseTokenUnits } from "~/utilities/parsers";
import BigNumber from "bignumber.js";
import { SUPPORTED_VAULTS } from "~/constants";

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
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isApproveLoading, setIsApproveLoading] = useState(false);
  const [isDepositLoading, setIsDepositLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [analyticsSent, setAnalyticsSent] = useState(false);

  const { portalsApprove, getPortals, getPortalsApproval } = usePortals();
  const sendTransaction = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

  const checkApproval = useCallback(async () => {
    if (!walletAddress || !selectedToken.address || !vaultAddress) return;

    try {
      // Ensure depositAmount is a valid number string before parsing
      const safeDepositAmount = new BigNumber(depositAmount || "0").toString();

      const value = parseTokenUnits(safeDepositAmount, selectedToken.decimals);

      // Check if this is native ETH (multiple possible representations)
      const isNativeETH =
        selectedToken.address ===
          "0x0000000000000000000000000000000000000000" ||
        selectedToken.address.toLowerCase() ===
          "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
        selectedToken.symbol?.toLowerCase() === "eth";

      if (isNativeETH) {
        setNeedsApproval(false);
        setCurrentStep(1);
        return;
      }

      try {
        const approval = await getPortalsApproval(
          chainId,
          String(walletAddress),
          selectedToken.address,
        );
        const allowance = approval ? approval.allowance : "0";

        const needsApprove = !new BigNumber(allowance.toString()).gte(
          new BigNumber(value.toString()),
        );

        // Update needs approval state
        setNeedsApproval(needsApprove);

        // Important: Update the current step based on approval status
        if (!needsApprove) {
          setCurrentStep(1); // Move to Convert step
        } else {
          setCurrentStep(0); // Stay at Approve step
        }

        // Reset any waiting state
        setIsWaitingForApproval(false);
      } catch (error) {
        console.error("Error checking approval:", error);
        // If we fail to check approval, let's just proceed to approval step
        setNeedsApproval(true);
        setCurrentStep(0);
      }
    } catch (err) {
      console.error("Error in approval flow:", err);
      setError("Failed to check token approval. Please try again.");
      setCurrentStep(0);
      setIsWaitingForApproval(false);
    }
  }, [
    walletAddress,
    selectedToken.address,
    selectedToken.decimals,
    selectedToken.symbol,
    vaultAddress,
    depositAmount,
    chainId,
    getPortalsApproval,
  ]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && txHash) {
      if (isWaitingForApproval) {
        setIsWaitingForApproval(false);
        // Don't reset currentStep here - wait until checkApproval completes

        // When approval is confirmed, immediately check if we need further approval
        if (currentStep === 0) {
          checkApproval(); // This will set the correct step based on approval status
        }
      }

      // If we're already at step 2, update balances and analytics
      if (currentStep === 2 && !analyticsSent) {
        // Find the corresponding vault to get the vaultSymbol
        const vault = SUPPORTED_VAULTS.find(
          (v) => v.vaultAddress.toLowerCase() === vaultAddress?.toLowerCase(),
        );

        // Only send analytics if transaction is successful and not sent before
        setAnalyticsSent(true); // Mark analytics as sent

        // Log analytics for convert action
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
            txHash: txHash,
            chainId: chainId,
            walletAddress: walletAddress,
          }),
        }).catch(console.error); // Handle error silently
      }
    }
  }, [
    isConfirmed,
    isWaitingForApproval,
    currentStep,
    selectedToken,
    depositAmount,
    vaultAddress,
    txHash,
    chainId,
    walletAddress,
    checkApproval,
    onSuccess,
    analyticsSent,
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

  const handleApprove = async () => {
    if (!walletAddress || !selectedToken.address || !vaultAddress) return;

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
        setCurrentStep(0); // Ensure we're on approval step

        // Ensure depositAmount is a valid number string before parsing
        const safeDepositAmount = new BigNumber(
          depositAmount || "0",
        ).toString();

        const value = parseTokenUnits(safeDepositAmount, selectedToken.decimals);

        const approvalData = await portalsApprove(
          chainId,
          walletAddress,
          selectedToken.address,
          value.toString(),
        );

        // Add more detailed checking and logging for approval data
        if (!approvalData) {
          console.error(
            "No approval data returned - this could mean approval is already sufficient",
          );
          setNeedsApproval(false);
          setCurrentStep(1);
          setIsWaitingForApproval(false);
          setIsApproveLoading(false);
          return;
        }

        if (!approvalData.approve) {
          console.error("Approval data missing 'approve' field:", approvalData);
          setNeedsApproval(false);
          setCurrentStep(1);
          setIsWaitingForApproval(false);
          setIsApproveLoading(false);
          return;
        }

        const hash = await sendTransaction.mutateAsync({
          to: approvalData.approve.to as `0x${string}`,
          data: approvalData.approve.data as `0x${string}`,
        });

        if (hash) {
          setTxHash(hash);
        }
        setNeedsApproval(false);
        setCurrentStep(1); // Explicitly set to step 1 (Convert)
      } catch (error: unknown) {
        console.error("Approval error:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to approve token. Please try again.";

        setError(message);
        setIsWaitingForApproval(false);
        setCurrentStep(0); // Reset to approval step on error
      } finally {
        setIsApproveLoading(false);
      }
    });
  };

  const handleDeposit = async () => {
    if (!walletAddress || !selectedToken.address || !vaultAddress) return;

    await handleWalletInteraction(async () => {
      try {
        setIsDepositLoading(true);
        setError(null);

        // Ensure depositAmount is a valid number string before parsing
        const safeDepositAmount = new BigNumber(
          depositAmount || "0",
        ).toString();

        const value = parseTokenUnits(safeDepositAmount, selectedToken.decimals);

        // Ensure we have valid addresses before proceeding
        const tokenInAddress = selectedToken.address;
        const tokenOutAddress = vaultAddress;

        if (!tokenInAddress || !tokenOutAddress) {
          throw new Error("Invalid token addresses");
        }

        const portalData = await getPortals({
          chainId,
          sender: walletAddress,
          tokenIn: selectedToken.address as string,
          inputAmount: value.toString(),
          tokenOut: vaultAddress as string,
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

        if (hash) {
          setTxHash(hash);
          setCurrentStep(2);
        }
      } catch (error: unknown) {
        console.error("Deposit error:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to convert tokens. Please try again.";

        setError(message);
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
      return; // Prevent closing while transactions are in progress
    }
    // Reset all state when closing
    setTxHash(null);
    setCurrentStep(0);
    setError(null);
    setNeedsApproval(true);
    setIsWaitingForApproval(false);
    setAnalyticsSent(false);

    // Close the modal without calling onSuccess again
    // The onSuccess was already called when the transaction was confirmed
    if (currentStep === 2) {
      onSuccess?.();
    } else {
      onClose();
    }
    onClose();
  };

  if (!isOpen) {
    // Clean up state when modal is not open
    if (txHash) setTxHash(null);
    return null;
  }

  const isTransactionInProgress =
    isWaitingForApproval ||
    isApproveLoading ||
    isDepositLoading ||
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
        aria-labelledby="convert-modal-title"
        aria-describedby="convert-modal-description"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="convert-modal-title" className="text-xl font-bold">
            Convert {selectedToken.symbol}
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

        <div id="convert-modal-description" className="sr-only">
          Convert {selectedToken.symbol} tokens to vault tokens. This process
          may require approval before conversion.
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
            <span className={needsApproval ? "" : "text-gray-400"}>
              {needsApproval
                ? isWaitingForApproval
                  ? "Approving..."
                  : "Approve"
                : "Approved"}
            </span>
            <span>Convert</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Transaction Details */}
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
                ? handleDeposit
                : handleClose
          }
          disabled={
            isTransactionInProgress || (currentStep === 2 && !isConfirmed)
          }
          isLoading={isTransactionInProgress}
          className="w-full relative"
        >
          {currentStep === 0 && needsApproval
            ? "Approve"
            : currentStep === 1 || (currentStep === 0 && !needsApproval)
              ? "Convert"
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
