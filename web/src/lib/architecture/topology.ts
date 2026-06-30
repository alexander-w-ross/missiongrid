/**
 * Static topology of the MissionGrid backend, drawn as a node/edge diagram.
 *
 * The browser can only directly observe the two ends of this pipeline — the
 * commands it sends and the events that arrive over the WebSocket — so the
 * intermediate Kafka/worker/Postgres hops below are the *canonical* topology
 * the live view animates against, not measured per-hop telemetry. Coordinates
 * are hand-placed on a fixed 1000×420 viewBox (a ~13-node fixed graph reads far
 * cleaner hand-laid than auto-routed, and needs no diagram library).
 *
 * `signals.ts` references nodes/edges by the ids declared here.
 */

export type NodeKind = "client" | "service" | "topic" | "worker" | "store";
export type EdgeKind =
  | "http"
  | "produce"
  | "consume"
  | "write"
  | "ws"
  | "telemetry"
  | "deadletter";

export interface ArchNodeData {
  id: string;
  label: string;
  sub?: string;
  kind: NodeKind;
  /** top-left + size, in viewBox units */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArchEdgeData {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string;
  /** optional waypoints for elbow/arc routing (fan-out + return loop) */
  via?: { x: number; y: number }[];
}

export const VIEW_W = 1380;
export const VIEW_H = 300;

export const NODES: ArchNodeData[] = [
  { id: "browser", kind: "client", label: "Operator Console", sub: "Browser", x: 24, y: 116, w: 128, h: 60 },
  { id: "api", kind: "service", label: "FastAPI API", sub: "commands + WS", x: 196, y: 116, w: 116, h: 60 },
  { id: "t_commands", kind: "topic", label: "mission.commands.v1", sub: "Kafka", x: 356, y: 122, w: 132, h: 48 },
  { id: "worker", kind: "worker", label: "Simulation Worker", sub: "A* · fire · LoS · 500ms tick", x: 540, y: 114, w: 140, h: 64 },
  { id: "t_events", kind: "topic", label: "mission.events.v1", sub: "Kafka", x: 728, y: 122, w: 132, h: 48 },
  { id: "ws", kind: "service", label: "WS Broadcaster", sub: "fan-out to clients", x: 924, y: 40, w: 156, h: 52 },
  { id: "projector", kind: "worker", label: "State Projector", sub: "fold events", x: 924, y: 118, w: 156, h: 56 },
  { id: "postgres", kind: "store", label: "Read Model", sub: "Postgres", x: 1128, y: 118, w: 152, h: 56 },
  { id: "ledger", kind: "store", label: "Idempotency Ledger", sub: "processed_messages", x: 924, y: 214, w: 156, h: 52 },
  { id: "deadletter", kind: "topic", label: "mission.dead_letter.v1", sub: "failed commands", x: 728, y: 216, w: 132, h: 46 },
  { id: "outbox", kind: "client", label: "Responder Outbox", sub: "buffered while dark", x: 196, y: 210, w: 128, h: 56 },
  { id: "t_telemetry", kind: "topic", label: "responder.telemetry.v1", sub: "Kafka", x: 356, y: 214, w: 132, h: 46 },
  { id: "tel_worker", kind: "worker", label: "Telemetry Worker", sub: "reconcile backlog", x: 540, y: 210, w: 140, h: 56 },
];

export const EDGES: ArchEdgeData[] = [
  { id: "e_http", from: "browser", to: "api", kind: "http" },
  { id: "e_api_produce", from: "api", to: "t_commands", kind: "produce" },
  { id: "e_cmd_consume", from: "t_commands", to: "worker", kind: "consume" },
  { id: "e_worker_produce", from: "worker", to: "t_events", kind: "produce" },
  { id: "e_proj_consume", from: "t_events", to: "projector", kind: "consume" },
  { id: "e_proj_write", from: "projector", to: "postgres", kind: "write" },
  { id: "e_proj_ledger", from: "projector", to: "ledger", kind: "write" },
  { id: "e_ws_consume", from: "t_events", to: "ws", kind: "consume" },
  { id: "e_ws_push", from: "ws", to: "browser", kind: "ws", via: [{ x: 520, y: 20 }] },
  { id: "e_dlq", from: "worker", to: "deadletter", kind: "deadletter" },
  { id: "e_outbox_flush", from: "worker", to: "outbox", kind: "telemetry", via: [{ x: 430, y: 196 }] },
  { id: "e_outbox_produce", from: "outbox", to: "t_telemetry", kind: "telemetry" },
  { id: "e_tel_consume", from: "t_telemetry", to: "tel_worker", kind: "consume" },
  { id: "e_tel_produce", from: "tel_worker", to: "t_events", kind: "telemetry", via: [{ x: 730, y: 202 }] },
];

export const NODE_BY_ID: Record<string, ArchNodeData> = Object.fromEntries(
  NODES.map((n) => [n.id, n]),
);
export const EDGE_BY_ID: Record<string, ArchEdgeData> = Object.fromEntries(
  EDGES.map((e) => [e.id, e]),
);

// ---------------------------------------------------------------------------
// Colour mapping (CSS-var tokens from globals.css)
// ---------------------------------------------------------------------------

/** token suffix → used both for stroke colour and arrow-marker id */
const EDGE_TOKEN: Record<EdgeKind, string> = {
  http: "teal",
  produce: "cyan",
  consume: "cyan",
  write: "green",
  ws: "teal",
  telemetry: "amber",
  deadletter: "red",
};

const NODE_TOKEN: Record<NodeKind, string> = {
  client: "teal",
  service: "cyan",
  worker: "green",
  topic: "amber",
  store: "cyan",
};

export const edgeToken = (kind: EdgeKind) => EDGE_TOKEN[kind];
export const edgeColor = (kind: EdgeKind) => `var(--color-${EDGE_TOKEN[kind]})`;
export const nodeToken = (kind: NodeKind) => NODE_TOKEN[kind];
export const nodeAccent = (kind: NodeKind) => `var(--color-${NODE_TOKEN[kind]})`;

/** Every distinct accent token — used to pre-declare arrow markers in <defs>. */
export const MARKER_TOKENS = ["teal", "cyan", "green", "amber", "red"] as const;

// ---------------------------------------------------------------------------
// Pure path geometry (no DOM) — used to render the edges and as the motion
// path for packets.
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };

/** Point where the segment from a node's centre toward (tx,ty) exits its box. */
function borderPoint(node: ArchNodeData, tx: number, ty: number): Pt {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? node.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? node.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  // nudge a few units clear of the border so the arrow/packet doesn't sit under it
  const len = Math.hypot(dx, dy);
  const pad = 3;
  return { x: cx + dx * (s + pad / len), y: cy + dy * (s + pad / len) };
}

function twoPointPath(a: Pt, b: Pt): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mx = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  }
  const my = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
}

/** Smooth Catmull-Rom path through all points (start, ...via, end). */
function smoothPath(pts: Pt[]): string {
  if (pts.length <= 2) return twoPointPath(pts[0], pts[pts.length - 1]);
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function edgePath(edge: ArchEdgeData): string {
  const from = NODE_BY_ID[edge.from];
  const to = NODE_BY_ID[edge.to];
  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const via = edge.via ?? [];
  const firstTarget = via[0] ?? tc;
  const lastTarget = via[via.length - 1] ?? fc;
  const start = borderPoint(from, firstTarget.x, firstTarget.y);
  const end = borderPoint(to, lastTarget.x, lastTarget.y);
  return smoothPath([start, ...via, end]);
}

/** Pure d-strings for every edge (safe at import time — no DOM). */
export const EDGE_PATHS: Record<string, string> = Object.fromEntries(
  EDGES.map((e) => [e.id, edgePath(e)]),
);

// ---------------------------------------------------------------------------
// Samplers — need the DOM (getPointAtLength), so built lazily on the client.
// ---------------------------------------------------------------------------

export interface EdgeSampler {
  length: number;
  sample: (t: number) => Pt;
}

/** Build a length + position sampler for each edge. Client-only. */
export function buildSamplers(): Record<string, EdgeSampler> {
  const out: Record<string, EdgeSampler> = {};
  for (const e of EDGES) {
    const d = EDGE_PATHS[e.id];
    if (typeof document === "undefined") {
      out[e.id] = { length: 0, sample: () => ({ x: 0, y: 0 }) };
      continue;
    }
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", d);
    const length = el.getTotalLength();
    out[e.id] = {
      length,
      sample: (t: number) => {
        const p = el.getPointAtLength(Math.max(0, Math.min(1, t)) * length);
        return { x: p.x, y: p.y };
      },
    };
  }
  return out;
}
