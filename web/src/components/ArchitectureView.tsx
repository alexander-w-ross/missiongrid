"use client";

import { useArchitectureSignals } from "@/hooks/useArchitectureSignals";
import {
  EDGE_PATHS,
  EDGES,
  MARKER_TOKENS,
  NODES,
  VIEW_H,
  VIEW_W,
} from "@/lib/architecture/topology";
import { cn } from "@/lib/utils";
import { ArchEdge } from "./architecture/ArchEdge";
import { ArchLegend } from "./architecture/ArchLegend";
import { ArchNode } from "./architecture/ArchNode";
import { ReplayControls } from "./architecture/ReplayControls";
import { ReplayEventList } from "./architecture/ReplayEventList";

/**
 * The System Data Flow view: a live diagram of the whole MissionGrid backend
 * pipeline. Commands the operator sends light the left half; events that arrive
 * over the WebSocket light the right-half fan-out (projector→Postgres and
 * WS→browser). See `useArchitectureSignals` for the engine that drives it.
 *
 * When `expanded`, the diagram sizes to its natural (width-driven) height and a
 * chronological mini event log fills the space beneath it; the replay transport
 * is shown in both modes.
 */
export function ArchitectureView({ expanded = false }: { expanded?: boolean }) {
  const { heatNodes, heatEdges, packets, outboxBuffering, connection, replay } =
    useArchitectureSignals();
  const mock = connection === "mock";
  const severed = connection === "closed";

  return (
    <div className="flex h-full w-full flex-col">
      <div className={cn("relative w-full", expanded ? "shrink-0" : "min-h-0 flex-1")}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn("w-full select-none", expanded ? "h-auto" : "h-full")}
        style={{ opacity: severed ? 0.45 : 1, transition: "opacity 0.4s" }}
        role="img"
        aria-label="System data flow — live diagram of the MissionGrid backend pipeline"
      >
        <defs>
          <filter id="arch-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {MARKER_TOKENS.map((t) => (
            <marker
              key={t}
              id={`arch-arrow-${t}`}
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill={`var(--color-${t})`} opacity={0.5} />
            </marker>
          ))}
        </defs>

        <g>
          {EDGES.map((e) => (
            <ArchEdge
              key={e.id}
              edge={e}
              d={EDGE_PATHS[e.id]}
              heat={heatEdges[e.id] ?? 0}
              mock={mock}
              severed={severed && (e.id === "e_http" || e.id === "e_ws_push")}
            />
          ))}
        </g>

        <g>
          {packets.map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={3.8}
              fill={p.color}
              filter="url(#arch-glow)"
            />
          ))}
        </g>

        <g>
          {NODES.map((n) => (
            <ArchNode
              key={n.id}
              node={n}
              heat={heatNodes[n.id] ?? 0}
              mock={mock}
              buffering={n.id === "outbox" ? outboxBuffering : 0}
            />
          ))}
        </g>
      </svg>

        <ArchLegend connection={connection} />
      </div>

      {expanded && <ReplayEventList replay={replay} />}
      <ReplayControls replay={replay} />
    </div>
  );
}
