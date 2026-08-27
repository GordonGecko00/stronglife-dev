import type { Slice } from "../lib/portfolio";

/** Fixed palette so a slice keeps its colour between the two breakdowns. */
const COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--hit)",
  "#8b5cf6",
  "#0ea5e9",
  "#f59e0b",
  "#ec4899",
  "#64748b",
];

function sliceColor(index: number): string {
  return COLORS[index % COLORS.length];
}

/**
 * One stacked bar plus a legend — the "where am I invested" answer in a glance.
 *
 * The bar itself is decorative; the legend below carries the same numbers as
 * text, so the split is readable without relying on colour.
 */
export default function AllocationBar({
  slices,
  formatValue,
}: {
  slices: Slice[];
  formatValue: (value: number) => string;
}) {
  const positive = slices.filter((slice) => slice.value > 0);

  if (positive.length === 0) {
    return <p className="muted">Add a holding to see how your money is split.</p>;
  }

  return (
    <div className="allocation">
      <div className="allocation-bar" aria-hidden="true">
        {positive.map((slice, index) => (
          <span
            key={slice.key}
            className="allocation-segment"
            style={{ width: `${slice.percent}%`, background: sliceColor(index) }}
          />
        ))}
      </div>
      <ul className="allocation-legend">
        {positive.map((slice, index) => (
          <li key={slice.key}>
            <span className="chart-swatch" style={{ background: sliceColor(index) }} aria-hidden="true" />
            <span className="allocation-label">{slice.label}</span>
            <span className="allocation-percent">{slice.percent.toFixed(1)}%</span>
            <span className="muted allocation-value">{formatValue(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
