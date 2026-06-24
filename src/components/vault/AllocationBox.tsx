import type { JSX } from "react";
import type { AllocationItem } from "~/utilities/allocation";
import { LoadingSpinner } from "~/components/icons";

interface AllocationBoxProps {
  allocations: AllocationItem[];
  loading?: boolean;
}

export default function AllocationBox({
  allocations,
  loading = false,
}: AllocationBoxProps): JSX.Element {
  return (
    <section className="allocation" aria-label="Vault allocation">
      <h2 className="block-title">Allocation</h2>

      {loading ? (
        <div className="allocation-loading">
          <LoadingSpinner size={24} />
        </div>
      ) : allocations.length === 0 ? (
        <p className="block-text">No allocation data available.</p>
      ) : (
        <ul className="alloc-list">
          {allocations.map((item) => (
            <li
              key={item.id}
              className={`alloc-row${item.pct > 0 ? " is-active" : ""}`}
            >
              <div className="alloc-head">
                <span className="alloc-name">{item.name}</span>
                <span className="alloc-pct">{item.pct.toFixed(2)}%</span>
              </div>
              <div className="alloc-bar">
                <span style={{ width: `${Math.min(item.pct, 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
