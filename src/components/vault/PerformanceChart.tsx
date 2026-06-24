import { useCallback, useMemo, useState } from "react";

import type { JSX, PointerEvent as ReactPointerEvent } from "react";

import { formatBalance } from "~/utilities/parsers";

export interface ChartPoint {
  timestamp: number;

  sharePrice: number;

  apy: number;

  tvl: number;
}

export type ChartMetric = "sharePrice" | "apy" | "tvl";

interface PerformanceChartProps {
  data: ChartPoint[];
}

const WIDTH = 1000;

const HEIGHT = 320;

const PAD_X = 14;

const PAD_TOP = 16;

const PAD_BOTTOM = 16;

const PLOT_PAD_X = 10;

const METRICS: {
  id: ChartMetric;

  label: string;

  format: (value: number) => string;
}[] = [
  {
    id: "sharePrice",

    label: "Share price",

    format: (value) => formatBalance(value.toString()),
  },

  {
    id: "apy",

    label: "APY",

    format: (value) => `${value.toFixed(2)}%`,
  },

  {
    id: "tvl",

    label: "TVL",

    format: formatTvl,
  },
];

function formatTvl(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;

  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;

  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;

  return `$${value.toFixed(0)}`;
}

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

export default function PerformanceChart({
  data,
}: PerformanceChartProps): JSX.Element {
  const [metric, setMetric] = useState<ChartMetric>("apy");

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const values = useMemo(
    () => data.map((point) => point[metric]),
    [data, metric],
  );

  const norm = useMemo(() => normalize(values), [values]);

  const currentMetric = METRICS.find((item) => item.id === metric)!;

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

  return (
    <div className="perf-chart">
      <div className="chart-tabs" role="tablist" aria-label="Chart metric">
        {METRICS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={metric === item.id}
            className={`chart-tab${metric === item.id ? " is-active" : ""}`}
            onClick={() => {
              setMetric(item.id);

              setActiveIndex(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="chart-readout">
        <span className="chart-readout-date">{readoutLabel}</span>

        <span className="chart-readout-value">
          {currentMetric.format(values[readoutIndex] ?? 0)}
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
          {norm.length > 1 && (
            <path
              d={linePath(norm)}
              fill="none"
              stroke="#ffb936"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
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

      {count > 0 && (
        <div className="chart-axis">
          <span>{formatChartDate(data[0].timestamp)}</span>

          <span>{formatChartDate(data[midIndex].timestamp)}</span>

          <span>today</span>
        </div>
      )}
    </div>
  );
}
