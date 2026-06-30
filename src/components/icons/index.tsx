import type { JSX } from "react";

export function EthIcon({ size = 40 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#627eea" />
      <g fill="#fff" fillRule="nonzero">
        <path fillOpacity="0.602" d="M16.498 4v8.87l7.497 3.35z" />
        <path d="M16.498 4 9 16.22l7.498-3.35z" />
        <path fillOpacity="0.602" d="M16.498 21.968v6.027L24 17.616z" />
        <path d="M16.498 27.995v-6.028L9 17.616z" />
        <path fillOpacity="0.2" d="M16.498 20.573l7.497-4.353-7.497-3.348z" />
        <path fillOpacity="0.602" d="M9 16.22l7.498 4.353v-7.701z" />
      </g>
    </svg>
  );
}

export function UsdcIcon({ size = 40 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#2775ca" />
      <text
        x="16"
        y="22.4"
        textAnchor="middle"
        fontFamily="var(--sans), system-ui, sans-serif"
        fontWeight="700"
        fontSize="18"
        fill="#fff"
      >
        $
      </text>
    </svg>
  );
}

export function EurcIcon({ size = 40 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#2775ca" />
      <text
        x="16"
        y="22.4"
        textAnchor="middle"
        fontFamily="var(--sans), system-ui, sans-serif"
        fontWeight="700"
        fontSize="18"
        fill="#fff"
      >
        €
      </text>
    </svg>
  );
}

export function CbbtcIcon({ size = 40 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#f7931a" />
      <text
        x="16"
        y="22.8"
        textAnchor="middle"
        fontFamily="var(--sans), system-ui, sans-serif"
        fontWeight="700"
        fontSize="16"
        fill="#fff"
      >
        ₿
      </text>
    </svg>
  );
}

export function BaseLogoIcon(): JSX.Element {
  return (
    <img
      src="/images/base.svg"
      alt=""
      width={11}
      height={11}
      aria-hidden="true"
    />
  );
}

export function ArrowRightIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowLeftIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12.5 8h-9M7 4.5 3.5 8 7 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.5 7 9 11.5 13.5 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LoadingSpinner({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={`loading-spinner${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function ExternalLinkIcon({
  size = 14,
}: {
  size?: number;
}): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 3.5H3.5v9h9V9.5" />
        <path d="M9.5 3.5h3v3" />
        <path d="M12.5 3.5 7.5 8.5" />
      </g>
    </svg>
  );
}

export function DiscordIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function XIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function VaultIcon({
  symbol,
  size = 40,
}: {
  symbol: string;
  size?: number;
}): JSX.Element {
  if (symbol === "WETH" || symbol === "ETH") return <EthIcon size={size} />;
  if (symbol === "USDC") return <UsdcIcon size={size} />;
  if (symbol === "EURC") return <EurcIcon size={size} />;
  if (symbol === "cbBTC") return <CbbtcIcon size={size} />;
  return <EthIcon size={size} />;
}
