import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { TokenInfo } from "~/types";
import { formatBalance } from "~/utilities/parsers";
import { displayDepositSymbol, getTokenIconPath } from "~/utilities/tokenIcons";
import { ChevronDownIcon } from "~/components/icons";

export type HoldingsMode = "deposit" | "withdraw";

const YIELD_DISCLAIMER =
  "This is an estimate based on the vault's recent historical APY. It is not a promise or guarantee of future returns. Yields vary and can go down, so treat it as rough guidance only.";

function sanitizeDecimalInput(raw: string): string {
  return raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
}

function isValidDecimalInput(value: string): boolean {
  return value === "" || /^\d*\.?\d*$/.test(value);
}

interface TokenSelectFieldProps {
  label: string;
  token: TokenInfo;
  tokenLabel: string;
  onSelect: () => void;
}

function TokenSelectField({
  label,
  token,
  tokenLabel,
  onSelect,
}: TokenSelectFieldProps): JSX.Element {
  return (
    <div className="form-field">
      <span className="field-label">{label}</span>
      <div className="token-select">
        <button
          type="button"
          className="token-select-btn"
          data-single="false"
          aria-haspopup="listbox"
          onClick={onSelect}
        >
          <span className="token-select-value">
            <img
              src={getTokenIconPath(token)}
              alt={tokenLabel}
              width={24}
              height={24}
              className="token-select-icon token-art"
            />
            <span className="token-symbol">{tokenLabel}</span>
          </span>
          <ChevronDownIcon />
        </button>
      </div>
    </div>
  );
}

interface YieldEstimateProps {
  amount: number;
  apy: number;
  tokenLabel: string;
}

function YieldEstimate({
  amount,
  apy,
  tokenLabel,
}: YieldEstimateProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const yearlyYield = amount * (apy / 100);

  useEffect(() => {
    setOpen(false);
  }, [amount, apy, tokenLabel]);

  return (
    <div className={`yield-estimate${open ? " is-expanded" : ""}`}>
      <div className="yield-estimate-row">
        <span className="yield-estimate-label">
          Est. Yearly Yield
          <button
            type="button"
            className="yield-estimate-hint"
            aria-label="About estimated yearly yield"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            ?
          </button>
        </span>
        <span className="yield-estimate-value">
          ≈ {formatBalance(yearlyYield.toString())} {tokenLabel} / yr
        </span>
      </div>
      {open && <p className="yield-estimate-disclaimer">{YIELD_DISCLAIMER}</p>}
    </div>
  );
}

interface HoldingsPanelProps {
  mode: HoldingsMode;
  selectedToken: TokenInfo;
  depositAmount: string;
  vaultBalance: TokenInfo | null;
  vaultSymbol: string;
  estimatedApy?: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  onTokenSelect: () => void;
  onAmountChange: (amount: string) => void;
  onMaxAmount: () => void;
  onSubmit: () => void;
}

export default function HoldingsPanel({
  mode,
  selectedToken,
  depositAmount,
  vaultBalance,
  vaultSymbol,
  estimatedApy,
  isConnected,
  isConnecting,
  onTokenSelect,
  onAmountChange,
  onMaxAmount,
  onSubmit,
}: HoldingsPanelProps): JSX.Element {
  const amount = parseFloat(depositAmount);
  const hasAmount = depositAmount !== "" && !Number.isNaN(amount) && amount > 0;
  const isDeposit = mode === "deposit";
  const tokenLabel = isDeposit
    ? displayDepositSymbol(selectedToken.symbol)
    : selectedToken.symbol;
  const apy = estimatedApy ? parseFloat(estimatedApy) : 0;

  const buttonLabel = !hasAmount
    ? "Enter an amount"
    : !isConnected
      ? isConnecting
        ? "Connecting..."
        : "Connect wallet"
      : isDeposit
        ? `Deposit ${depositAmount} ${tokenLabel}`.trim()
        : `Exit ${depositAmount} ${vaultSymbol}`.trim();

  const availableBalance = isDeposit
    ? selectedToken.balance
    : (vaultBalance?.balance ?? "0");

  const availableSymbol = isDeposit ? tokenLabel : vaultSymbol;

  return (
    <div className="panel">
      {isDeposit && (
        <TokenSelectField
          label="Select token"
          token={selectedToken}
          tokenLabel={tokenLabel}
          onSelect={onTokenSelect}
        />
      )}

      <div className="form-field">
        <div className="field-row">
          <label className="field-label" htmlFor="deposit-amount">
            Enter amount
          </label>
          {isConnected && (
            <button
              type="button"
              className="field-balance"
              onClick={onMaxAmount}
            >
              My Balance:{" "}
              <span className="field-balance-value">
                {formatBalance(availableBalance)} {availableSymbol}
              </span>
            </button>
          )}
        </div>
        <div className="amount-input">
          <input
            id="deposit-amount"
            type="text"
            inputMode="decimal"
            value={depositAmount}
            onChange={(e) => {
              const value = sanitizeDecimalInput(e.target.value);
              if (isValidDecimalInput(value)) {
                onAmountChange(value);
              }
            }}
            placeholder="0.0"
          />
          <button type="button" className="max-btn" onClick={onMaxAmount}>
            MAX
          </button>
          <span className="amount-token">{availableSymbol}</span>
        </div>
      </div>

      {isDeposit && hasAmount && apy > 0 && (
        <YieldEstimate amount={amount} apy={apy} tokenLabel={tokenLabel} />
      )}

      {!isDeposit && (
        <TokenSelectField
          label="Receive token"
          token={selectedToken}
          tokenLabel={tokenLabel}
          onSelect={onTokenSelect}
        />
      )}

      <button
        type="button"
        className="cta-primary earn-cta"
        disabled={!hasAmount || isConnecting}
        onClick={onSubmit}
      >
        {buttonLabel}
      </button>

      {!isConnected && (
        <p className="panel-note">
          Connect a wallet to {isDeposit ? "deposit" : "withdraw"}.
        </p>
      )}
    </div>
  );
}
