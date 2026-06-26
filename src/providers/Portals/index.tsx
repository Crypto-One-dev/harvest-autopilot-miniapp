import React, { createContext, useContext } from "react";
import axios from "axios";
import { getChainNamePortals } from "~/utilities/parsers";
import { PORTALS_FI_API_URL } from "~/constants";
interface PortalsContextType {
  SUPPORTED_TOKEN_LIST: Record<number, Record<string, string>>;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  getPortalsBaseTokens: (chainId: number) => Promise<any[]>;
  getPortalsBalances: (
    address: string,
    chainId: number,
  ) => Promise<any[] | null>;
  getPortalsSupport: (chainId: number, tokenAddress: string) => Promise<any>;
  getPortalsToken: (chainId: number, tokenAddress: string) => Promise<any>;
  getPortalsApproval: (
    chainId: number,
    fromAddress: string,
    tokenAddress: string,
    inputAmount?: string,
  ) => Promise<any>;
  portalsApprove: (
    chainId: number,
    fromAddress: `0x${string}` | undefined,
    tokenAddress: `0x${string}` | undefined,
    inputAmount: string,
  ) => Promise<any>;
  getPortals: (params: PortalsParams) => Promise<any>;
  getPortalsEstimate: (
    params: PortalsEstimateParams,
  ) => Promise<{ res: any; succeed: boolean }>;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

interface PortalsParams {
  chainId: number;
  sender: string;
  tokenIn: string;
  inputAmount: string;
  tokenOut: string;
  slippage?: number | null;
  validate?: boolean;
}

interface PortalsEstimateParams {
  chainId: number;
  tokenIn: string;
  inputAmount: string;
  tokenOut: string;
  slippage: number;
  sender: string;
}

const PortalsContext = createContext<PortalsContextType | null>(null);

export const usePortals = () => {
  const context = useContext(PortalsContext);
  if (!context) {
    throw new Error("usePortals must be used within a PortalsProvider");
  }
  return context;
};

const authToken = process.env.NEXT_PUBLIC_PORTALS_API_KEY;

export const SUPPORTED_TOKEN_LIST = {
  8453: {
    USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    DAI: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
    ETH: "0x0000000000000000000000000000000000000000",
    WETH: "0x4200000000000000000000000000000000000006",
    cbBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  },
} as const;

interface PortalsProviderProps {
  children: React.ReactNode;
}

export function PortalsProvider({ children }: PortalsProviderProps) {
  const getPortalsBalances = async (address: string, chainId: number) => {
    if (!address || !chainId) {
      console.error("Missing required parameters:", { address, chainId });
      return [];
    }

    const network = getChainNamePortals(chainId);

    try {
      const response = await axios.get("/api/portals/account", {
        params: {
          owner: address,
          networks: network,
        },
        timeout: 20000,
      });

      if (!response.data || !response.data.balances) {
        console.warn("Invalid Portals balance response:", response.data);
        return null;
      }

      return response.data.balances;
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
        console.warn("Portals balance sync timed out, will retry later");
      } else {
        console.warn("Error fetching balances:", error);
      }
      return null;
    }
  };

  const getPortalsBaseTokens = async (chainId: number) => {
    try {
      const supportedTokens =
        SUPPORTED_TOKEN_LIST[chainId as keyof typeof SUPPORTED_TOKEN_LIST];
      const addressesQueryString = Object.entries(supportedTokens)
        .map(([_, address]) => {
          return `addresses=${getChainNamePortals(chainId)}:${address}`;
        })
        .join("&");

      const response = await axios.get(
        `${PORTALS_FI_API_URL}/v2/tokens?${addressesQueryString}&networks=${getChainNamePortals(chainId)}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      return response.data.tokens;
    } catch (error) {
      console.error("Error fetching base tokens:", error);
      return [];
    }
  };

  const getPortalsSupport = async (chainId: number, tokenAddress: string) => {
    try {
      const addresses = `${getChainNamePortals(chainId)}:${tokenAddress}`;
      const response = await axios.get(`${PORTALS_FI_API_URL}/v2/tokens`, {
        params: {
          addresses,
          minLiquidity: 0,
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      return response;
    } catch (error) {
      console.error("Error fetching token:", error);
      if (error && typeof error === "object" && "response" in error) {
        return error.response;
      }
      return null;
    }
  };

  const getPortalsToken = async (chainId: number, tokenAddress: string) => {
    try {
      const addresses = `${getChainNamePortals(chainId)}:${tokenAddress}`;
      const response = await axios.get(`${PORTALS_FI_API_URL}/v2/tokens`, {
        params: {
          addresses,
          minLiquidity: 0,
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      return response.data?.tokens[0];
    } catch (error) {
      console.error("Error fetching token:", error);
      return [];
    }
  };

  const getPortalsApproval = async (
    chainId: number,
    fromAddress: string,
    tokenAddress: string,
    inputAmount: string = "0",
  ) => {
    try {
      const inputToken = `${getChainNamePortals(chainId)}:${tokenAddress}`;
      const response = await axios.get("/api/portals/approval", {
        params: { sender: fromAddress, inputToken, inputAmount },
        timeout: 10000,
      });
      return response.data?.context ?? null;
    } catch (error) {
      console.error("Error fetching approvals:", error);
      if (axios.isAxiosError(error)) {
        console.error("Approval check error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
      }
      return null;
    }
  };

  const portalsApprove = async (
    chainId: number,
    fromAddress: `0x${string}` | undefined,
    tokenAddress: `0x${string}` | undefined,
    inputAmount: string,
  ) => {
    try {
      const inputToken = `${getChainNamePortals(chainId)}:${tokenAddress}`;
      const response = await axios.get("/api/portals/approval", {
        params: { sender: fromAddress, inputToken, inputAmount },
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching approve data:", error);
      if (axios.isAxiosError(error)) {
        console.error("Approval error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
      }
      throw error; // Propagate the error to handle it in the UI
    }
  };

  const getPortals = async ({
    chainId,
    sender,
    tokenIn,
    inputAmount,
    tokenOut,
    slippage,
    validate,
  }: PortalsParams) => {
    try {
      const inputToken = `${getChainNamePortals(chainId)}:${tokenIn}`;
      const outputToken = `${getChainNamePortals(chainId)}:${tokenOut}`;
      const shouldValidate = validate ?? slippage === null;

      const params: Record<string, string | number | boolean> = {
        sender,
        inputToken,
        inputAmount,
        outputToken,
        feePercentage: 0,
        partner: "0xF066789028fE31D4f53B69B81b328B8218Cc0641",
        validate: shouldValidate,
      };

      if (slippage != null) {
        params.slippageTolerancePercentage = slippage;
      }

      const response = await axios.get("/api/portals/portal", {
        params,
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching routes:", error);
      if (axios.isAxiosError(error)) {
        console.error("Portal error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
      }
      throw error; // Propagate the error to handle it in the UI
    }
  };

  const getPortalsEstimate = async ({
    chainId,
    tokenIn,
    inputAmount,
    tokenOut,
    slippage,
    sender,
  }: PortalsEstimateParams) => {
    try {
      const inputToken = `${getChainNamePortals(chainId)}:${tokenIn}`;
      const outputToken = `${getChainNamePortals(chainId)}:${tokenOut}`;
      const response = await axios.get(
        `${PORTALS_FI_API_URL}/v2/portal/estimate`,
        {
          params: {
            inputToken,
            inputAmount,
            outputToken,
            slippageTolerancePercentage: slippage,
            sender,
          },
        },
      );
      return { res: response.data, succeed: true };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error(
        "Error fetching estimates:",
        error.response?.data?.message || error,
      );
      return { res: error.response?.data, succeed: false };
    }
  };

  return (
    <PortalsContext.Provider
      value={{
        SUPPORTED_TOKEN_LIST,
        getPortalsBaseTokens,
        getPortalsBalances,
        getPortalsSupport,
        getPortalsToken,
        getPortalsApproval,
        portalsApprove,
        getPortals,
        getPortalsEstimate,
      }}
    >
      {children}
    </PortalsContext.Provider>
  );
}
