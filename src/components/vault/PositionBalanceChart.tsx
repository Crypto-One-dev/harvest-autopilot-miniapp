import { useCallback, useMemo, useState } from "react";
import type { JSX, PointerEvent as ReactPointerEvent } from "react";
import type { ChartDataPoint } from "~/types";
import { formatBalance } from "~/utilities/parsers";
import { LoadingSpinner } from "~/components/icons";

interface PositionBalanceChartProps {
  data: ChartDataPoint[];
  tokenSymbol: string;
  loading?: boolean;
}

const WIDTH = 1000;
const HEIGHT = 200;
const PAD_X = 14;
const PAD_TOP = 12;
const PAD_BOTTOM = 12;
const PLOT_PAD_X = 10;

function formatChartDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((value) => 0.08 + ((value - min) / span) * 0.84);
}

function linePath(norm: number[]): string {
  const count = norm.length;
  if (count < 2) return "";

  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  return norm
    .map((value, index) => {
      const x = PAD_X + (innerW * index) / (count - 1);
      const y = PAD_TOP + innerH * (1 - value);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaPath(norm: number[]): string {
  const line = linePath(norm);
  if (!line) return "";

  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const lastX = PAD_X + innerW;
  const firstX = PAD_X;
  const bottomY = PAD_TOP + innerH;

  return `${line} L${lastX.toFixed(1)} ${bottomY.toFixed(1)} L${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
}

export default function PositionBalanceChart({
  data,
  tokenSymbol,
  loading = false,
}: PositionBalanceChartProps): JSX.Element {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const values = useMemo(() => data.map((point) => point.value), [data]);
  const norm = useMemo(() => normalize(values), [values]);

  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const count = values.length;

  const xAt = useCallback(
    (index: number) => PAD_X + (innerW * index) / Math.max(count - 1, 1),
    [count, innerW],
  );

  const yAt = useCallback(
    (index: number) => PAD_TOP + innerH * (1 - norm[index]),
    [innerH, norm],
  );

  const readoutIndex = activeIndex ?? Math.max(count - 1, 0);
  const readoutLabel =
    activeIndex === null
      ? "Today"
      : formatChartDate(data[readoutIndex].timestamp);

  const pickIndex = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (count === 0) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const innerLeft = rect.left + PLOT_PAD_X;
      const usable = rect.width - PLOT_PAD_X * 2;
      const fraction = Math.min(
        1,
        Math.max(0, (event.clientX - innerLeft) / usable),
      );
      setActiveIndex(Math.round(fraction * (count - 1)));
    },
    [count],
  );

  const midIndex = Math.floor((count - 1) / 2);

  if (loading) {
    return (
      <div className="position-chart">
        <div className="chart-plot chart-plot-loading">
          <LoadingSpinner size={28} />
        </div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="position-chart">
        <p className="panel-note">
          Balance history will appear after your first deposit.
        </p>
      </div>
    );
  }

  return (
    <div className="position-chart">
      <div className="chart-readout">
        <span className="chart-readout-date">{readoutLabel}</span>
        <span className="chart-readout-value">
          {formatBalance((values[readoutIndex] ?? 0).toString())} {tokenSymbol}
        </span>
      </div>

      <div
        className="chart-plot"
        onPointerDown={pickIndex}
        onPointerMove={(event) => {
          if (event.buttons === 1) pickIndex(event);
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <svg
          className="chart-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="position-balance-fill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#ffb936" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffb936" stopOpacity="0" />
            </linearGradient>
          </defs>

          {norm.length > 1 && (
            <>
              <path d={areaPath(norm)} fill="url(#position-balance-fill)" />
              <path
                d={linePath(norm)}
                fill="none"
                stroke="#ffb936"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}

          {activeIndex !== null && count > 0 && (
            <>
              <line
                x1={xAt(activeIndex)}
                y1={PAD_TOP}
                x2={xAt(activeIndex)}
                y2={HEIGHT - PAD_BOTTOM}
                stroke="#19171733"
                strokeWidth="1"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={xAt(activeIndex)}
                cy={yAt(activeIndex)}
                r="5"
                fill="#ffb936"
                stroke="#fff"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
      </div>

      {count > 1 && (
        <div className="chart-axis">
          <span>{formatChartDate(data[0].timestamp)}</span>
          <span>{formatChartDate(data[midIndex].timestamp)}</span>
          <span>today</span>
        </div>
      )}
    </div>
  );
}
