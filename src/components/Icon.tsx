import type { ReactNode } from "react";

/**
 * A small stroked icon set. Emoji render inconsistently and read as clip-art
 * next to the rest of the type, so the handful of glyphs the app needs are
 * drawn here and inherit `currentColor`.
 */
export type IconName =
  | "moon"
  | "alert"
  | "check"
  | "chevron"
  | "flame"
  | "dumbbell"
  | "drop"
  | "leaf";

const PATHS: Record<IconName, ReactNode> = {
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  alert: (
    <>
      <path d="M12 4.5 2.8 20h18.4L12 4.5Z" />
      <path d="M12 10v4.2" />
      <path d="M12 17.2h.01" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  flame: <path d="M12 3s5 4.2 5 8.6A5 5 0 0 1 7 12c0-1.6.7-2.8 1.6-3.8.4 1 1 1.8 1.9 2.2 0-2.6.9-5.3 1.5-7.4Z" />,
  dumbbell: (
    <>
      <path d="M3 9v6M6.5 6.5v11M17.5 6.5v11M21 9v6" />
      <path d="M6.5 12h11" />
    </>
  ),
  drop: <path d="M12 3.5c3 3.7 5.5 6.6 5.5 9.4a5.5 5.5 0 1 1-11 0C6.5 10.1 9 7.2 12 3.5Z" />,
  leaf: (
    <>
      <path d="M20 4c0 9-5.5 13-11 13a5 5 0 0 1-.6-9.9C13 6.5 16 6 20 4Z" />
      <path d="M4 20c2.5-4 5-6.5 9-8.5" />
    </>
  ),
};

export default function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
