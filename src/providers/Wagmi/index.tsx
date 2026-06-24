import {
  createConfig,
  createStorage,
  cookieStorage,
  http,
  WagmiProvider,
} from "wagmi";
import { injected, baseAccount } from "~/lib/wagmiConnectors";
import { getBuilderDataSuffix } from "~/lib/builderCode";
import { base } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://mainnet.base.org";
const builderDataSuffix = getBuilderDataSuffix();

export const config = createConfig({
  chains: [base],
  connectors: [
    baseAccount({
      appName: "Harvest",
      preference: {
        telemetry: false,
      },
    }),
    injected({ shimDisconnect: true }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  ...(builderDataSuffix ? { dataSuffix: builderDataSuffix } : {}),
  transports: {
    [base.id]: http(RPC_URL),
  },
  syncConnectedChain: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 1000,
      gcTime: 1000,
    },
  },
});

export default function WagmiAppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
