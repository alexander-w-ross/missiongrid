import { CELL } from "@/lib/grid";

/**
 * SVG fragment rendering the mission-control station as a hardened amber square
 * with a crosshair. Position is animated via a CSS transform on the wrapping
 * group so it glides when relocated.
 */
export function MissionControlMarker({ cx, cy }: { cx: number; cy: number }) {
  const s = CELL * 0.62;
  return (
    <g
      style={{
        transform: `translate(${cx}px, ${cy}px)`,
        transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <circle r={s * 1.5} fill="var(--color-mc)" opacity={0.08} />
      <rect
        x={-s / 2}
        y={-s / 2}
        width={s}
        height={s}
        fill="none"
        stroke="var(--color-mc)"
        strokeWidth={2}
        filter="url(#mg-glow)"
      />
      <rect
        x={-s / 2 + 3}
        y={-s / 2 + 3}
        width={s - 6}
        height={s - 6}
        fill="var(--color-mc)"
        opacity={0.18}
      />
      {/* crosshair */}
      <line x1={-s} y1={0} x2={-s / 2} y2={0} stroke="var(--color-mc)" strokeWidth={1} />
      <line x1={s / 2} y1={0} x2={s} y2={0} stroke="var(--color-mc)" strokeWidth={1} />
      <line x1={0} y1={-s} x2={0} y2={-s / 2} stroke="var(--color-mc)" strokeWidth={1} />
      <line x1={0} y1={s / 2} x2={0} y2={s} stroke="var(--color-mc)" strokeWidth={1} />
      <text
        y={s + 11}
        textAnchor="middle"
        fontSize={9}
        fontFamily="var(--font-mono)"
        fill="var(--color-mc)"
        letterSpacing="0.15em"
      >
        MC
      </text>
    </g>
  );
}
