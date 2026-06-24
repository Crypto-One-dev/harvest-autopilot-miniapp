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
    <svg
      width="15"
      height="15"
      viewBox="0 0 146 146"
      fill="none"
      aria-hidden="true"
      role="presentation"
    >
      <path
        d="M72.84 145.68C113.07 145.68 145.68 113.07 145.68 72.84C145.68 32.61 113.07 0 72.84 0C34.66 0 3.34 29.38 0.23 66.74H96.35V79.02H0.23C3.34 116.31 34.66 145.68 72.84 145.68Z"
        fill="#ffffff"
      />
    </svg>
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

export function VaultIcon({
  symbol,
  size = 40,
}: {
  symbol: string;
  size?: number;
}): JSX.Element {
  if (symbol === "WETH" || symbol === "ETH") return <EthIcon size={size} />;
  if (symbol === "USDC") return <UsdcIcon size={size} />;
  if (symbol === "cbBTC") return <CbbtcIcon size={size} />;
  return <EthIcon size={size} />;
}
