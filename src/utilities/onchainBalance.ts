import { erc20Abi } from "viem";
import { getBalance, readContract } from "@wagmi/core";
import BigNumber from "bignumber.js";
import { config } from "~/providers/Wagmi";
import { isNativeEthAddress } from "~/utilities/portalsTokens";

/**
 * Reads the live ERC-20 balance straight from the chain. Portals' indexed
 * balance can lag, which causes MAX/deposit amounts to exceed what transferFrom
 * can actually move.
 */
export async function getOnchainErc20Balance({
  token,
  owner,
  chainId,
}: {
  token: `0x${string}`;
  owner: `0x${string}`;
  chainId: number;
}): Promise<bigint> {
  return readContract(config, {
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
    chainId: chainId as (typeof config)["chains"][number]["id"],
  });
}

export async function getOnchainTokenBalance({
  token,
  owner,
  chainId,
}: {
  token: `0x${string}`;
  owner: `0x${string}`;
  chainId: number;
}): Promise<bigint> {
  if (isNativeEthAddress(token)) {
    const balance = await getBalance(config, {
      address: owner,
      chainId: chainId as (typeof config)["chains"][number]["id"],
    });
    return balance.value;
  }

  return getOnchainErc20Balance({ token, owner, chainId });
}

export async function isOnchainBalanceSufficient({
  token,
  owner,
  chainId,
  requiredAmount,
}: {
  token: `0x${string}`;
  owner: `0x${string}`;
  chainId: number;
  requiredAmount: string;
}): Promise<boolean> {
  try {
    const balance = await getOnchainTokenBalance({ token, owner, chainId });
    return new BigNumber(balance.toString()).gte(new BigNumber(requiredAmount));
  } catch (error) {
    console.warn("Failed to read on-chain balance:", error);
    return false;
  }
}
