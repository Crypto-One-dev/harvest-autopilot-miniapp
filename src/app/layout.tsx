import type { Metadata } from "next";

import "~/app/globals.css";
import { Providers } from "~/app/providers";

const BASE_URL = "miniapp.harvest.finance";
const domain = BASE_URL ? `https://${BASE_URL}` : "http://localhost:3000";

const frame = {
  version: "next",
  imageUrl: `${domain}/harvest-thumbnail.png`,
  button: {
    title: "Use Autopilot",
    action: {
      type: "launch_frame",
      name: "Yield Autopilot",
      url: domain,
      splashImageUrl: `${domain}/splash.png`,
      splashBackgroundColor: "#f7cf50",
    },
  },
};

export const metadata: Metadata = {
  title: "Yield Autopilot",
  description: "Put your USDC, ETH or cbBTC to work with Autopilot that allocates to the best performing yield sources.",
  openGraph: {
    title: "Yield Autopilot",
    description: "Put your USDC, ETH or cbBTC to work with Autopilot that allocates to the best performing yield sources.",
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
  other: {
    "fc:frame": JSON.stringify(frame),
    "base:app_id": "6a316f0306f4fa422358585d",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
