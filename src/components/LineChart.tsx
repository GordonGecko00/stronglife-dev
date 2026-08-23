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

const PADDING = { top: 12, right: 14, bottom: 22, left: 40 };
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
 */
export default function LineChart({
  series,
  unit,
  caption,
}: {
  series: Series[];
  unit: string;
  caption?: string;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const { visible, allPoints, scale } = useMemo(() => {
    const visible = series.filter((s) => s.points.length > 0);
    const allPoints = visible.flatMap((s) => s.points);
    if (allPoints.length === 0) return { visible, allPoints, scale: null };

    const xs = allPoints.map((p) => p.x);
    const ys = allPoints.map((p) => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMinRaw = Math.min(...ys);
    const yMaxRaw = Math.max(...ys);
    // Pad the y-range so a flat line doesn't sit on the axis.
    const span = yMaxRaw - yMinRaw || Math.max(yMaxRaw * 0.1, 1);
    const yMin = Math.max(0, yMinRaw - span * 0.15);
    const yMax = yMaxRaw + span * 0.15;
    const plotWidth = Math.max(1, width - PADDING.left - PADDING.right);
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

    return {
      visible,
      allPoints,
      scale: {
        xMin,
        xMax,
        yMin,
        yMax,
        x: (value: number) =>
          PADDING.left +
          (xMax === xMin ? plotWidth / 2 : ((value - xMin) / (xMax - xMin)) * plotWidth),
        y: (value: number) =>
          PADDING.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight,
      },
    };
  }, [series, width]);

  // A single data point has no trend to draw; the value itself is the story.
  if (allPoints.length === 0 || !scale) {
    return (
      <div className="chart-empty" ref={ref}>
        Not enough history yet — finish a workout to start the chart.
      </div>
    );
  }

  const ticks = niceTicks(scale.yMin, scale.yMax);
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
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={scale.y(tick)}
              y2={scale.y(tick)}
            />
            <text className="chart-axis-label" x={PADDING.left - 6} y={scale.y(tick) + 4} textAnchor="end">
              {formatWeight(Math.round(tick))}
            </text>
          </g>
        ))}

        <text className="chart-axis-label" x={PADDING.left} y={HEIGHT - 6}>
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
                {s.name} {formatWeight(Math.round(point.y * 10) / 10)} {unit}
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
                    {s.name} ({unit})
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
                    return <td key={s.name}>{point ? formatWeight(Math.round(point.y * 10) / 10) : "—"}</td>;
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
