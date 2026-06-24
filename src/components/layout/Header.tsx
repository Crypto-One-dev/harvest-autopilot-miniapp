import type { JSX } from "react";
import WalletBadge from "./WalletBadge";

interface HeaderProps {
  onBrandClick?: () => void;
}

export default function Header({ onBrandClick }: HeaderProps): JSX.Element {
  return (
    <header className="app-top">
      <button
        type="button"
        className="brand"
        aria-label="Harvest, go to homepage"
        onClick={onBrandClick}
      >
        <span className="brand-name">Harvest</span>
        <span className="brand-dot" aria-hidden="true" />
      </button>
      <WalletBadge />
    </header>
  );
}
