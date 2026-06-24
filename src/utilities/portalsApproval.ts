import axios from "axios";
import BigNumber from "bignumber.js";

export interface PortalsApprovalContext {
  allowance?: string;
  shouldApprove?: boolean;
}

export function isPortalsApprovalSufficient(
  context: PortalsApprovalContext | null | undefined,
  requiredAmount: string,
): boolean {
  if (!context) return false;

  if (context.shouldApprove === true) return false;
  if (context.shouldApprove === false) return true;

  const allowance = context.allowance ?? "0";
  return new BigNumber(allowance).gte(new BigNumber(requiredAmount));
}

export function isTransferFromFailed(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const message = error.response?.data?.message;
  return (
    typeof message === "string" && message.includes("TRANSFER_FROM_FAILED")
  );
}

export async function waitForPortalsApproval(
  check: () => Promise<PortalsApprovalContext | null | undefined>,
  requiredAmount: string,
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const { attempts = 15, intervalMs = 2000 } = options;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const context = await check();
    if (isPortalsApprovalSufficient(context, requiredAmount)) {
      return true;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return false;
}

export async function getPortalsWithRetry<T>(
  fetchPortal: () => Promise<T>,
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<T> {
  const { attempts = 8, intervalMs = 2500 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchPortal();
    } catch (error) {
      lastError = error;
      if (!isTransferFromFailed(error) || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw lastError;
}
