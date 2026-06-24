import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self';
    connect-src 'self' 
      https://base.app
      https://*.base.org
      https://*.coinbase.com
      https://cloudflareinsights.com 
      https://explorer-api.walletconnect.com 
      https://*.walletconnect.com 
      https://*.walletconnect.org 
      https://mainnet.base.org
      https://base-mainnet.g.alchemy.com
      https://*.alchemy.com
      https://1rpc.io 
      wss://*.base.org 
      ws://*.base.org 
      http://*.base.org 
      https://relay.walletconnect.com 
      https://registry.walletconnect.com 
      https://verify.walletconnect.com 
      https://api.walletconnect.com 
      wss://*.walletconnect.com 
      wss://*.walletconnect.org
      https://api.portals.fi
      https://*.portals.fi
      https://cca-lite.coinbase.com
      https://*.amplitude.com;
  `
    .replace(/\s+/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", cspHeader);

  const allowedOrigins = [
    "https://base.app",
    "https://explorer-api.walletconnect.com",
    "https://*.walletconnect.com",
    "https://*.walletconnect.org",
  ];

  const origin = request.headers.get("origin");

  if (
    origin &&
    allowedOrigins.some((allowed) =>
      allowed.includes("*")
        ? origin.endsWith(allowed.replace("*", ""))
        : origin === allowed,
    )
  ) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE, HEAD",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
