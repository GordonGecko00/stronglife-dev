/**
 * A bare trend line for a table row: no axes, no labels, no interaction.
 *
 * It's decoration for a number that's already on screen, so it's hidden from
 * screen readers — the price and the change next to it carry the meaning.
 */
export default function Sparkline({
  values,
  width = 64,
  height = 22,
  color,
}: {
  values: number[];
  width?: number;
  height?: number;
  color: string;
}) {
  const points = values.filter((value) => Number.isFinite(value));
  if (points.length < 2) return <span className="sparkline-empty" aria-hidden="true" />;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  // Inset by the stroke radius so the extremes aren't clipped at the edges.
  const inset = 1.5;
  const usable = height - inset * 2;

  const path = points
    .map((value, index) => {
      const x = index * step;
      const y = inset + usable - ((value - min) / span) * usable;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
