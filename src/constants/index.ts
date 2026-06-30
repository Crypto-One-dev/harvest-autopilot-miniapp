import { VaultInfo } from "~/types";

export const HARVEST_API_URL = "https://api.harvest.finance";
export const PORTALS_FI_API_URL = "https://api.portals.fi";

export const SUPPORTED_VAULTS: VaultInfo[] = [
  {
    symbol: "WETH",
    name: "Wrapped Ethereum",
    id: "IPOR_WETH_base",
    icon: "/images/tokens/eth.svg",
    address: "0x4200000000000000000000000000000000000006",
    vaultAddress: "0x7872893e528Fe2c0829e405960db5B742112aa97",
    decimals: 18,
    vaultDecimals: 20,
    balance: "0",
    balanceUSD: "0",
    images: ["/images/tokens/eth.svg"],
    vaultSymbol: "bAutopilot_wETH",
    rawBalance: "0",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    id: "IPOR_USDC_base",
    icon: "/images/tokens/usdc.svg",
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    vaultAddress: "0x0d877Dc7C8Fa3aD980DfDb18B48eC9F8768359C4",
    decimals: 6,
    vaultDecimals: 8,
    balance: "0",
    balanceUSD: "0",
    images: ["/images/tokens/usdc.svg"],
    vaultSymbol: "bAutopilot_USDC",
    rawBalance: "0",
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    id: "IPOR_EURC_base",
    icon: "/images/tokens/eurc.svg",
    address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
    vaultAddress: "0x180493090667A35D8511Be743835dAD8715d33be",
    decimals: 6,
    vaultDecimals: 8,
    balance: "0",
    balanceUSD: "0",
    images: ["/images/tokens/eurc.svg"],
    vaultSymbol: "bAutopilot_EURC",
    rawBalance: "0",
  },
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    id: "IPOR_cbBTC_base",
    icon: "/images/tokens/cbbtc.svg",
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    vaultAddress: "0x31A421271414641cb5063B71594b642D2666dB6B",
    decimals: 8,
    vaultDecimals: 10,
    balance: "0",
    balanceUSD: "0",
    images: ["/images/tokens/cbbtc.svg"],
    vaultSymbol: "bAutopilot_cbBTC",
    rawBalance: "0",
  },
];

export const FALLBACK_TOKEN_ICON =
  "https://etherscan.io/images/main/empty-token.png";

export const VAULT_DISPLAY_ORDER = ["WETH", "USDC", "EURC", "cbBTC"] as const;

export const SOCIAL_LINKS = {
  TWITTER: "https://twitter.com/harvest_finance",
  DISCORD: "https://discord.gg/ePZKmST7yn",
} as const;

export const VAULT_DISPLAY: Record<
  string,
  { title: string; subtitle: string }
> = {
  WETH: {
    title: "WETH Autopilot",
    subtitle: "Auto-compounding",
  },
  USDC: {
    title: "USDC Autopilot",
    subtitle: "Auto-compounding",
  },
  EURC: {
    title: "EURC Autopilot",
    subtitle: "Auto-compounding",
  },
  cbBTC: {
    title: "cbBTC Autopilot",
    subtitle: "Auto-compounding",
  },
};
