import { decodeFunctionData, erc20Abi, isAddress } from "viem";
import { readContract } from "@wagmi/core";
import BigNumber from "bignumber.js";
import { config } from "~/providers/Wagmi";

/**
 * Extracts the spender address from an ERC-20 `approve(spender, amount)` calldata
 * blob returned by the Portals approval endpoint.
 */
export function decodeApprovalSpender(
  data: string | undefined | null,
): `0x${string}` | null {
  if (!data) return null;

  try {
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: data as `0x${string}`,
    });

    if (decoded.functionName === "approve") {
      const spender = decoded.args?.[0] as string | undefined;
      if (spender && isAddress(spender)) {
        return spender as `0x${string}`;
      }
    }
  } catch (error) {
    console.warn("Failed to decode approval spender:", error);
  }

  return null;
}

/**
 * Reads the live ERC-20 allowance straight from the chain, bypassing the
 * Portals indexer which can lag behind freshly-confirmed approvals.
 */
export async function getOnchainAllowance({
  token,
  owner,
  spender,
  chainId,
}: {
  token: `0x${string}`;
  owner: `0x${string}`;
  spender: `0x${string}`;
  chainId: number;
}): Promise<bigint> {
  return readContract(config, {
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
    chainId: chainId as (typeof config)["chains"][number]["id"],
  });
}

export async function isOnchainAllowanceSufficient({
  token,
  owner,
  spender,
  chainId,
  requiredAmount,
}: {
  token: `0x${string}`;
  owner: `0x${string}`;
  spender: `0x${string}`;
  chainId: number;
  requiredAmount: string;
}): Promise<boolean> {
  try {
    const allowance = await getOnchainAllowance({
      token,
      owner,
      spender,
      chainId,
    });
    return new BigNumber(allowance.toString()).gte(
      new BigNumber(requiredAmount),
    );
  } catch (error) {
    console.warn("Failed to read on-chain allowance:", error);
    return false;
  }
}

/**
 * Polls the on-chain allowance until it covers `requiredAmount` or attempts run
 * out. This is the source of truth for "is the approval actually live", as
 * opposed to what the Portals approval API reports.
 */
export async function waitForOnchainAllowance({
  token,
  owner,
  spender,
  chainId,
  requiredAmount,
  attempts = 15,
  intervalMs = 2000,
}: {
  token: `0x${string}`;
  owner: `0x${string}`;
  spender: `0x${string}`;
  chainId: number;
  requiredAmount: string;
  attempts?: number;
  intervalMs?: number;
}): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const sufficient = await isOnchainAllowanceSufficient({
      token,
      owner,
      spender,
      chainId,
      requiredAmount,
    });

    if (sufficient) return true;

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return false;
}
