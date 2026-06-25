import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import BigNumber from "bignumber.js";
import type { HarvestVaultData, TokenInfo, VaultInfo } from "~/types";
import {
  formatBalance,
  formatCtaAmount,
  formatUsd,
} from "~/utilities/parsers";
import { displayDepositSymbol, getTokenIconPath } from "~/utilities/tokenIcons";
import {
  getVaultUnderlyingBalance,
  getUnderlyingUsdPrice,
} from "~/utilities/vaultBalances";
import { useHoldingsTransaction } from "~/hooks/useHoldingsTransaction";
import { ChevronDownIcon, LoadingSpinner } from "~/components/icons";

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
  tokenUsdPrice: number;
}

function YieldEstimate({
  amount,
  apy,
  tokenUsdPrice,
}: YieldEstimateProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const yearlyYieldUsd = amount * tokenUsdPrice * (apy / 100);

  useEffect(() => {
    setOpen(false);
  }, [amount, apy, tokenUsdPrice]);

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
          ≈ {formatUsd(yearlyYieldUsd)} / yr
        </span>
      </div>
      {open && <p className="yield-estimate-disclaimer">{YIELD_DISCLAIMER}</p>}
    </div>
  );
}

interface HoldingsPanelProps {
  mode: HoldingsMode;
  chainId: number;
  vault: VaultInfo;
  selectedToken: TokenInfo;
  depositAmount: string;
  withdrawShareAmount: string;
  vaultBalance: TokenInfo | null;
  vaultsData?: Record<string, HarvestVaultData> | null;
  estimatedApy?: string | null;
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  onTokenSelect: () => void;
  onAmountChange: (amount: string) => void;
  onMaxAmount: () => void;
  onConnect: () => void;
  onNotify: (message: string, type?: "error" | "success") => void;
  onSuccess: () => void | Promise<void>;
}

export default function HoldingsPanel({
  mode,
  chainId,
  vault,
  selectedToken,
  depositAmount,
  withdrawShareAmount,
  vaultBalance,
  vaultsData,
  estimatedApy,
  walletAddress,
  isConnected,
  isConnecting,
  onTokenSelect,
  onAmountChange,
  onMaxAmount,
  onConnect,
  onNotify,
  onSuccess,
}: HoldingsPanelProps): JSX.Element {
  const amount = parseFloat(depositAmount);
  const hasAmount = depositAmount !== "" && !Number.isNaN(amount) && amount > 0;
  const isDeposit = mode === "deposit";
  const tokenLabel = isDeposit
    ? displayDepositSymbol(selectedToken.symbol)
    : selectedToken.symbol;
  const underlyingSymbol = vault.symbol;
  const vaultData = vaultsData?.[vault.id] ?? null;
  const apy = estimatedApy ? parseFloat(estimatedApy) : 0;
  const tokenUsdPrice =
    parseFloat(selectedToken.price || "0") || getUnderlyingUsdPrice(vaultData);
  const underlyingPosition = useMemo(
    () =>
      getVaultUnderlyingBalance(vaultBalance, vaultData, vault.decimals),
    [vaultBalance, vaultData, vault.decimals],
  );

  const availableBalance = isDeposit
    ? selectedToken.balance
    : underlyingPosition.underlying.toString();

  const availableSymbol = isDeposit ? tokenLabel : underlyingSymbol;

  const { needsApproval, isBusy, handleAction } = useHoldingsTransaction({
    mode,
    chainId,
    walletAddress,
    vault,
    selectedToken,
    amount: depositAmount,
    shareAmount: withdrawShareAmount,
    isConnected,
    onSuccess: async () => {
      await onSuccess();
      onNotify(
        isDeposit ? "Deposit successful" : "Exit successful",
        "success",
      );
    },
    onError: (message) => onNotify(message, "error"),
  });

  const formattedAmount = formatCtaAmount(depositAmount);

  const buttonLabel = !hasAmount
    ? "Enter an amount"
    : !isConnected
      ? "Connect"
      : needsApproval
        ? `Approve ${formattedAmount} ${isDeposit ? tokenLabel : underlyingSymbol}`
        : isDeposit
          ? `Deposit ${formattedAmount} ${tokenLabel}`
          : `Exit ${formattedAmount} ${underlyingSymbol}`;

  const showCtaSpinner = hasAmount && (isBusy || isConnecting);

  const balanceUsd =
    !isDeposit && isConnected
      ? underlyingPosition.usd > 0
        ? `≈ ${formatUsd(underlyingPosition.usd)}`
        : ""
      : "";

  const handleCtaClick = () => {
    if (!hasAmount) return;
    if (!isConnected) {
      onConnect();
      return;
    }

    if (isDeposit) {
      const availableBalance = new BigNumber(selectedToken.rawBalance || "0").div(
        new BigNumber(10).pow(selectedToken.decimals),
      );
      if (new BigNumber(depositAmount).gt(availableBalance)) {
        onNotify(
          `Insufficient ${tokenLabel} balance. Available: ${formatBalance(selectedToken.balance)}`,
          "error",
        );
        return;
      }
    } else if (
      new BigNumber(depositAmount).gt(underlyingPosition.underlying)
    ) {
      onNotify(
        `Insufficient ${underlyingSymbol} balance. Available: ${formatBalance(underlyingPosition.underlying.toString())}`,
        "error",
      );
      return;
    }

    void handleAction();
  };

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

      {!isDeposit && isConnected && (
        <div className="position-box holdings-balance-box">
          <span className="position-ico" aria-hidden="true">
            <img
              src={getTokenIconPath(vault)}
              alt={underlyingSymbol}
              width={20}
              height={20}
              className="token-art"
            />
          </span>
          <span className="position-label">My Balance</span>
          <span className="position-value">
            {formatBalance(underlyingPosition.underlying.toString())}{" "}
            {underlyingSymbol}
          </span>
          {balanceUsd && <span className="position-usd">{balanceUsd}</span>}
        </div>
      )}

      <div className="form-field">
        <div className="field-row">
          <label className="field-label" htmlFor="deposit-amount">
            Enter amount
          </label>
          {isConnected && isDeposit && (
            <button
              type="button"
              className="field-balance"
              onClick={onMaxAmount}
            >
              My Balance:{" "}
              <span className="field-balance-value">
                {formatBalance(availableBalance)}
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
          {!isDeposit && (
            <span className="amount-token">{availableSymbol}</span>
          )}
        </div>
      </div>

      {isDeposit && hasAmount && apy > 0 && tokenUsdPrice > 0 && (
        <YieldEstimate
          amount={amount}
          apy={apy}
          tokenUsdPrice={tokenUsdPrice}
        />
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
        disabled={!hasAmount || isConnecting || isBusy}
        onClick={handleCtaClick}
        aria-busy={showCtaSpinner}
        aria-label={showCtaSpinner ? buttonLabel : undefined}
      >
        {showCtaSpinner ? (
          <LoadingSpinner size={22} className="cta-spinner" />
        ) : (
          buttonLabel
        )}
      </button>

      {!isConnected && (
        <p className="panel-note">
          Connect a wallet to {isDeposit ? "deposit" : "withdraw"}.
        </p>
      )}
    </div>
  );
}
