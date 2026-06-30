import type { Metadata } from "next";
import "~/app/globals.css";
import { Providers } from "~/app/providers";

const BASE_URL = "miniapp.harvest.finance";
const domain = BASE_URL ? `https://${BASE_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  title: "Harvest - Earn on Autopilot",
  description:
    "Put your USDC, EURC, ETH or cbBTC to work with Autopilot that allocates to the best performing yield sources.",
  openGraph: {
    title: "Harvest - Earn on Autopilot",
    description:
      "Put your USDC, EURC, ETH or cbBTC to work with Autopilot that allocates to the best performing yield sources.",
    images: [
      {
        url: `${domain}/harvest-thumbnail.png`,
        alt: "Yield Autopilot",
      },
    ],
  },
  icons: {
    icon: [
      {
        url: `${domain}/favicon.svg`,
        type: "image/svg+xml",
      },
    ],
  },
  themeColor: "#ffb936",
  other: {
    "base:app_id": "6a32d3ca154104d02cdb618e",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
