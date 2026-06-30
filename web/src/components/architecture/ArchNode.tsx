import { nodeAccent, type ArchNodeData } from "@/lib/architecture/topology";

/**
 * One system node. Brightens / glows with `heat` (0–1) when data is passing
 * through it. In mock mode the Kafka/Postgres nodes that don't really exist are
 * drawn ghosted (dashed) to keep the view honest.
 */
export function ArchNode({
  node,
  heat,
  mock,
  buffering,
}: {
  node: ArchNodeData;
  heat: number;
  mock: boolean;
  buffering: number;
}) {
  const accent = nodeAccent(node.kind);
  const cx = node.x + node.w / 2;
  const isTopic = node.kind === "topic";
  const rx = isTopic ? node.h / 2 : 6;
  const virtual = mock && (node.kind === "topic" || node.kind === "store");
  const showBuffer = node.id === "outbox" && buffering > 0;

  return (
    <g>
      {heat > 0.02 && (
        <rect
          x={node.x - 3}
          y={node.y - 3}
          width={node.w + 6}
          height={node.h + 6}
          rx={rx + 3}
          fill="none"
          stroke={accent}
          strokeWidth={1}
          opacity={heat * 0.5}
          filter="url(#arch-glow)"
        />
      )}
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={rx}
        fill="var(--color-surface)"
        stroke={accent}
        strokeWidth={1 + heat * 1.4}
        strokeDasharray={virtual ? "4 3" : undefined}
        opacity={virtual ? 0.85 : 1}
      />
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={rx}
        fill={accent}
        opacity={0.05 + heat * 0.18}
      />
      <text
        x={cx}
        y={node.y + (node.sub ? node.h / 2 - 2 : node.h / 2 + 3)}
        textAnchor="middle"
        fontSize={isTopic ? 9.5 : 11}
        fontFamily={isTopic ? "var(--font-mono)" : "var(--font-display)"}
        fontWeight={600}
        fill="var(--color-ink)"
      >
        {node.label}
      </text>
      {node.sub && (
        <text
          x={cx}
          y={node.y + node.h / 2 + 11}
          textAnchor="middle"
          fontSize={7.5}
          fontFamily="var(--font-mono)"
          fill={showBuffer ? "var(--color-amber)" : "var(--color-muted)"}
          letterSpacing="0.04em"
        >
          {showBuffer ? `${buffering} buffered` : node.sub}
        </text>
      )}
      {showBuffer && (
        <circle cx={node.x + node.w - 9} cy={node.y + 9} r={3} fill="var(--color-amber)">
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </g>
  );
}
