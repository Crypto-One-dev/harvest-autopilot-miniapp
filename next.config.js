/** @type {import('next').NextConfig} */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

const nextConfig = {
  transpilePackages: ["wagmi", "@wagmi/core", "@wagmi/connectors"],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@wagmi-connectors/baseAccount": path.resolve(
        __dirname,
        "node_modules/@wagmi/connectors/dist/esm/baseAccount.js",
      ),
    };

    if (!isServer) {
      config.resolve.alias["@base-org/account"] = path.resolve(
        __dirname,
        "node_modules/@base-org/account/dist/index.js",
      );
    }

    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-Requested-With, Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              connect-src 'self' 
                https://base.app
                https://*.coinbase.com
                https://*.base.org 
                https://mainnet.base.org 
                https://1rpc.io 
                wss://*.base.org 
                ws://*.base.org 
                http://*.base.org 
                https://relay.walletconnect.com/* 
                https://registry.walletconnect.com/* 
                https://verify.walletconnect.com/* 
                https://api.walletconnect.com/* 
                wss://*.walletconnect.com/* 
                https://api.portals.fi 
                https://*.portals.fi
                https://api.harvest.finance/*
                https://*.harvest.finance/*
                https://base-mainnet.g.alchemy.com
                https://*.alchemy.com;
              script-src 'self' 'unsafe-eval' 'unsafe-inline';
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https: blob:;
              font-src 'self' data:;
              frame-src 'self' https://*.walletconnect.com;
              worker-src 'self' blob:;
            `
              .replace(/\s+/g, " ")
              .trim(),
          },
        ],
      },
    ];
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
