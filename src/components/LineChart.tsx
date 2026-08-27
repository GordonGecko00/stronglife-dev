import { useMemo, useState } from "react";
import type { SeriesPoint } from "../store/selectors";
import { useElementWidth } from "./useElementWidth";
import { formatShortDate } from "../lib/misc";
import { formatWeight } from "../lib/units";

export interface Series {
  name: string;
  color: string;
  points: SeriesPoint[];
}

const PADDING = { top: 12, right: 14, bottom: 22 };
/** Enough room for a weight label; money labels are measured and get more. */
const MIN_LEFT = 40;
const HEIGHT = 180;
const MARKER_LIMIT = 24;

function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/**
 * Single- or two-series time chart. Both series share one y-axis and one unit —
 * a second scale would make the crossing point meaningless.
 *
 * Values default to weight formatting, which is what every lifting chart wants;
 * `formatValue` / `formatAxis` let the money views render currency through the
 * same component instead of forking it.
 */
export default function LineChart({
  series,
  unit,
  caption,
  formatValue = (value) => formatWeight(Math.round(value * 10) / 10),
  formatAxis = (value) => formatWeight(Math.round(value)),
  emptyLabel = "Not enough history yet — finish a workout to start the chart.",
}: {
  series: Series[];
  unit: string;
  caption?: string;
  formatValue?: (value: number) => string;
  formatAxis?: (value: number) => string;
  emptyLabel?: string;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const { visible, allPoints, scale, ticks, padLeft } = useMemo(() => {
    const visible = series.filter((s) => s.points.length > 0);
    const allPoints = visible.flatMap((s) => s.points);
    const empty = { visible, allPoints, scale: null, ticks: [] as number[], padLeft: MIN_LEFT };
    if (allPoints.length === 0) return empty;

    const xs = allPoints.map((p) => p.x);
    const ys = allPoints.map((p) => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMinRaw = Math.min(...ys);
    const yMaxRaw = Math.max(...ys);
    // Pad the y-range so a flat line doesn't sit on the axis.
    const span = yMaxRaw - yMinRaw || Math.max(Math.abs(yMaxRaw) * 0.1, 1);
    // Weights can't go below zero, so the axis is anchored there; net worth can
    // (a mortgage outweighs the portfolio), and clamping it would invert the axis.
    const padded = yMinRaw - span * 0.15;
    const yMin = yMinRaw >= 0 ? Math.max(0, padded) : padded;
    const yMax = yMaxRaw + span * 0.15;

    const ticks = niceTicks(yMin, yMax);
    // Currency labels are far wider than "185", so make room for the longest.
    const longest = ticks.reduce((max, tick) => Math.max(max, formatAxis(tick).length), 0);
    const padLeft = Math.max(MIN_LEFT, longest * 7 + 10);

    const plotWidth = Math.max(1, width - padLeft - PADDING.right);
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

    return {
      visible,
      allPoints,
      ticks,
      padLeft,
      scale: {
        xMin,
        xMax,
        yMin,
        yMax,
        x: (value: number) =>
          padLeft +
          (xMax === xMin ? plotWidth / 2 : ((value - xMin) / (xMax - xMin)) * plotWidth),
        y: (value: number) =>
          PADDING.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight,
      },
    };
  }, [series, width, formatAxis]);

  // A single data point has no trend to draw; the value itself is the story.
  if (allPoints.length === 0 || !scale) {
    return (
      <div className="chart-empty" ref={ref}>
        {emptyLabel}
      </div>
    );
  }

  const timeline = [...new Set(allPoints.map((p) => p.x))].sort((a, b) => a - b);
  const hoverX = hover !== null ? timeline[hover] : null;

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    let nearest = 0;
    let bestDistance = Infinity;
    timeline.forEach((x, index) => {
      const distance = Math.abs(scale!.x(x) - px);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });
    setHover(nearest);
  }

  return (
    <div className="chart" ref={ref}>
      {visible.length > 1 && (
        <div className="chart-legend">
          {visible.map((s) => (
            <span className="chart-legend-item" key={s.name}>
              <span className="chart-swatch" style={{ background: s.color }} aria-hidden="true" />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={caption ?? "Progress chart"}
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
        style={{ touchAction: "pan-y" }}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="chart-grid"
              x1={padLeft}
              x2={width - PADDING.right}
              y1={scale.y(tick)}
              y2={scale.y(tick)}
            />
            <text className="chart-axis-label" x={padLeft - 6} y={scale.y(tick) + 4} textAnchor="end">
              {formatAxis(tick)}
            </text>
          </g>
        ))}

        <text className="chart-axis-label" x={padLeft} y={HEIGHT - 6}>
          {formatShortDate(scale.xMin)}
        </text>
        {scale.xMax !== scale.xMin && (
          <text className="chart-axis-label" x={width - PADDING.right} y={HEIGHT - 6} textAnchor="end">
            {formatShortDate(scale.xMax)}
          </text>
        )}

        {hoverX !== null && (
          <line
            className="chart-crosshair"
            x1={scale.x(hoverX)}
            x2={scale.x(hoverX)}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
          />
        )}

        {visible.map((s) => {
          const path = s.points
            .map((p, index) => `${index === 0 ? "M" : "L"}${scale.x(p.x)},${scale.y(p.y)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {s.points.length <= MARKER_LIMIT &&
                s.points.map((p) => (
                  <circle
                    key={p.x}
                    cx={scale.x(p.x)}
                    cy={scale.y(p.y)}
                    r={4}
                    fill={s.color}
                    className="chart-marker"
                  />
                ))}
              {hoverX !== null &&
                s.points
                  .filter((p) => p.x === hoverX)
                  .map((p) => (
                    <circle
                      key={`hover-${p.x}`}
                      cx={scale.x(p.x)}
                      cy={scale.y(p.y)}
                      r={6}
                      fill={s.color}
                      className="chart-marker"
                    />
                  ))}
            </g>
          );
        })}
      </svg>

      {hoverX !== null && (
        <div className="chart-tooltip" role="status">
          <strong>{formatShortDate(hoverX)}</strong>
          {visible.map((s) => {
            const point = s.points.find((p) => p.x === hoverX);
            if (!point) return null;
            return (
              <span key={s.name}>
                <span className="chart-swatch" style={{ background: s.color }} aria-hidden="true" />
                {s.name} {formatValue(point.y)}
                {unit ? ` ${unit}` : ""}
              </span>
            );
          })}
        </div>
      )}

      <button className="btn-link chart-table-toggle" onClick={() => setShowTable((v) => !v)}>
        {showTable ? "Hide values" : "Show values"}
      </button>

      {showTable && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {visible.map((s) => (
                  <th key={s.name}>
                    {unit ? `${s.name} (${unit})` : s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeline.map((x) => (
                <tr key={x}>
                  <td>{formatShortDate(x)}</td>
                  {visible.map((s) => {
                    const point = s.points.find((p) => p.x === x);
                    return <td key={s.name}>{point ? formatValue(point.y) : "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
