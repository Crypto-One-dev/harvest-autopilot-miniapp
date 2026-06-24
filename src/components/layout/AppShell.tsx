import type { JSX, ReactNode } from "react";
import Header from "./Header";

interface AppShellProps {
  children: ReactNode;
  onBrandClick?: () => void;
}

export default function AppShell({
  children,
  onBrandClick,
}: AppShellProps): JSX.Element {
  return (
    <main className="app-shell">
      <div className="app-frame">
        <Header onBrandClick={onBrandClick} />
        {children}
      </div>
    </main>
  );
}
