"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
  type Connector,
} from "wagmi";
import { ChevronDownIcon } from "~/components/icons";

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletBadge(): JSX.Element {
  const { address, isConnected } = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const connectors = useConnectors();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleConnect = () => {
    const connector: Connector | undefined =
      connectors.find((c: Connector) => c.id === "baseAccount") ??
      connectors.find((c: Connector) => c.id === "injected") ??
      connectors[0];

    if (connector) {
      connect.mutate({ connector });
    }
  };

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        className="wallet-badge"
        onClick={handleConnect}
        disabled={connect.isPending}
      >
        <span className="wallet-dot is-off" aria-hidden="true" />
        <span className="wallet-text">
          {connect.isPending ? "Connecting…" : "Connect Wallet"}
        </span>
      </button>
    );
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="wallet-wrap" ref={ref}>
      <button
        type="button"
        className="wallet-badge"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="wallet-dot is-on" aria-hidden="true" />
        <span className="wallet-text">{shortAddress(address)}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <div className="wallet-menu" role="menu">
          <button
            type="button"
            className="wallet-menu-item"
            role="menuitem"
            onClick={copyAddress}
          >
            {copied ? "Copied!" : "Copy address"}
          </button>
          <button
            type="button"
            className="wallet-menu-item"
            role="menuitem"
            onClick={() => {
              disconnect.mutate();
              setOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
