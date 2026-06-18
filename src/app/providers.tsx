"use client";

import dynamic from "next/dynamic";
import { PropsWithChildren } from "react";
import { PortalsProvider } from "~/providers/Portals";

const WagmiAppProvider = dynamic(() => import("~/providers/Wagmi"), {
  ssr: false,
});

export function Providers({ children }: PropsWithChildren) {
  return (
    <WagmiAppProvider>
      <PortalsProvider>{children}</PortalsProvider>
    </WagmiAppProvider>
  );
}
