import type { JSX } from "react";

export default function LegalFooter(): JSX.Element {
  return (
    <footer className="legal-footer">
      <p>
        By participating in any of the products you accept our{" "}
        <a
          href="https://docs.harvest.finance/legal/terms-of-use"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Use
        </a>{" "}
        and{" "}
        <a
          href="https://docs.harvest.finance/legal/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>
        .
      </p>
      <p>
        Harvest&apos;s smart contracts have been independently{" "}
        <a
          href="https://docs.harvest.finance/legal/audits"
          target="_blank"
          rel="noopener noreferrer"
        >
          audited
        </a>
        , but audits don&apos;t remove risk. Only deposit what you can afford to
        lose.
      </p>
    </footer>
  );
}
