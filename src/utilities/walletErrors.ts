import axios from "axios";

export type WalletAction = "approve" | "deposit" | "exit" | "transaction";

const USER_REJECTION_PATTERNS = [
  /user rejected/i,
  /user cancelled/i,
  /user canceled/i,
  /user denied/i,
  /action rejected/i,
  /rejected the request/i,
  /denied transaction/i,
  /request rejected/i,
];

function collectErrorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;

  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.message;
    return typeof apiMessage === "string" ? apiMessage : error.message;
  }

  if (error instanceof Error) {
    const parts = [error.message];
    const withMeta = error as Error & {
      shortMessage?: string;
      details?: string;
      cause?: unknown;
    };
    if (withMeta.shortMessage) parts.push(withMeta.shortMessage);
    if (withMeta.details) parts.push(withMeta.details);
    if (withMeta.cause) parts.push(collectErrorText(withMeta.cause));
    return parts.join("\n");
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof record.message === "string") parts.push(record.message);
    if (typeof record.shortMessage === "string") parts.push(record.shortMessage);
    if (typeof record.details === "string") parts.push(record.details);
    if (record.cause) parts.push(collectErrorText(record.cause));
    return parts.join("\n");
  }

  return String(error);
}

export function isUserRejection(error: unknown): boolean {
  const text = collectErrorText(error);
  if (USER_REJECTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: number }).code
      : undefined;
  return code === 4001;
}

function isTechnicalWalletDump(text: string): boolean {
  return (
    text.length > 160 ||
    text.includes("Request Arguments") ||
    text.includes("Version: viem") ||
    /0x[a-fA-F0-9]{8,}/.test(text)
  );
}

function defaultFailureMessage(action: WalletAction): string {
  switch (action) {
    case "approve":
      return "Approval failed. Please try again.";
    case "deposit":
      return "Deposit failed. Please try again.";
    case "exit":
      return "Exit failed. Please try again.";
    default:
      return "Transaction failed. Please try again.";
  }
}

/**
 * Turns wallet / viem / API errors into short user-facing copy.
 * Returns null when the user intentionally cancelled — no toast needed.
 */
export function parseWalletError(
  error: unknown,
  action: WalletAction = "transaction",
  options: { isCrossAsset?: boolean; insufficientOnchainBalance?: boolean } = {},
): string | null {
  if (isUserRejection(error)) {
    return null;
  }

  const text = collectErrorText(error);
  const { isCrossAsset = false, insufficientOnchainBalance = false } = options;

  if (text.includes("TRANSFER_FROM_FAILED")) {
    if (insufficientOnchainBalance) {
      return action === "exit"
        ? "Your vault balance changed. Tap MAX again or enter a lower amount."
        : "Your wallet balance changed. Tap MAX again or enter a lower amount.";
    }

    return action === "exit"
      ? "Approval is still syncing on Base. Wait a few seconds, then tap Exit again."
      : "Approval is still syncing on Base. Wait a few seconds, then tap Deposit again.";
  }

  if (/slippage too high|Insufficient buy/i.test(text)) {
    return isCrossAsset
      ? "This swap needs a larger amount. Try increasing your deposit, or use the vault's native token."
      : "Slippage is too tight for this trade. Try a slightly larger amount.";
  }

  if (/execution reverted/i.test(text)) {
    return isCrossAsset
      ? "This cross-token deposit can't complete for this amount. Try a larger amount or deposit with the vault token directly."
      : "This transaction would fail on Base. Try again in a few seconds.";
  }

  if (/insufficient funds/i.test(text)) {
    return "Not enough ETH on Base to cover network fees.";
  }

  if (/network|timeout|fetch failed/i.test(text)) {
    return "Network error. Check your connection and try again.";
  }

  if (isTechnicalWalletDump(text)) {
    return defaultFailureMessage(action);
  }

  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length <= 120) {
    return trimmed;
  }

  return defaultFailureMessage(action);
}
