import { edgeColor, edgeToken, type ArchEdgeData } from "@/lib/architecture/topology";

/**
 * One pipeline edge: a dim base line always, plus a brighter flowing-dash
 * overlay whose strength tracks `heat` (the SMIL dash animation matches the
 * project's existing inline-SVG idiom). `severed` renders the browser's real
 * links as broken when the connection drops; `mock` dashes the inferred Kafka
 * hops that don't exist in the in-browser simulation.
 */
export function ArchEdge({
  edge,
  d,
  heat,
  mock,
  severed,
}: {
  edge: ArchEdgeData;
  d: string;
  heat: number;
  mock: boolean;
  severed: boolean;
}) {
  if (severed) {
    return (
      <path
        d={d}
        fill="none"
        stroke="var(--color-red)"
        strokeWidth={1.4}
        strokeDasharray="5 5"
        opacity={0.6}
      />
    );
  }

  const color = edgeColor(edge.kind);
  const marker = `url(#arch-arrow-${edgeToken(edge.kind)})`;
  const baseDash =
    mock && edge.kind !== "http" && edge.kind !== "ws" ? "5 4" : undefined;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        opacity={0.16}
        strokeDasharray={baseDash}
        markerEnd={marker}
      />
      {heat > 0.04 && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.7}
          opacity={0.25 + heat * 0.6}
          strokeDasharray="7 11"
          strokeLinecap="round"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="18;0"
            dur="0.7s"
            repeatCount="indefinite"
          />
        </path>
      )}
    </g>
  );
}
