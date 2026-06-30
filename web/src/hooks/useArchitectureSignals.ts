"use client";

/**
 * The animation engine for the System Data Flow view.
 *
 * It listens to two real signal sources — outbound command pings
 * (`activityBus`) and inbound events (the mission store's `events` head) — and
 * turns them into "packets" that hop node→node along topology edges, plus a
 * decaying "heat" per node/edge that makes active stages glow. All churn is kept
 * local here (a single self-suspending requestAnimationFrame loop); nothing
 * high-frequency is written to the mission store, so the rest of the console
 * never re-renders on simulation ticks.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { activityBus } from "@/lib/activityBus";
import {
  buildSamplers,
  EDGE_BY_ID,
  EDGES,
  NODES,
  type EdgeSampler,
} from "@/lib/architecture/topology";
import {
  COMMAND_FLOW,
  eventFlow,
  TELEMETRY_FLOW,
  type FlowStep,
} from "@/lib/architecture/signals";
import type { ConnectionState, MissionEvent, MissionEventType } from "@/lib/types";
import { useMissionStore } from "@/store/missionStore";

const SPEED = 0.42; // viewBox units per ms — constant visual packet speed
const MIN_DUR = 300;
const MAX_DUR = 1500;
const DECAY_NODE = 1100; // ms for a node's glow to fade
const DECAY_EDGE = 750; // ms for an edge's flow to fade
const MAX_PER_EDGE = 3; // cap concurrent packets on one edge
const TICK_COALESCE = 340; // ms — min gap between full packet sweeps for tick events
const MAX_FRESH = 8; // cap events animated per store update (snapshot replay guard)

const BASE_DELAY = 700; // ms between replayed events at 1× (lower speed = longer gap)
/** Replay speed steps, slowest → real cadence. */
export const REPLAY_SPEEDS = [0.25, 0.5, 1] as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

interface Packet {
  id: number;
  edge: string;
  color: string;
  start: number;
  dur: number;
  children: FlowStep[];
}

interface Engine {
  nodeTs: Record<string, number>;
  edgeTs: Record<string, number>;
  setConnection: (c: ConnectionState) => void;
  command: () => void;
  event: (type: MissionEventType) => void;
  dispose: () => void;
}

function createEngine(
  samplersRef: { current: Record<string, EdgeSampler> },
  setPackets: (p: Packet[]) => void,
  setNow: (n: number) => void,
  setBuffer: (n: number) => void,
): Engine {
  const pks: Packet[] = [];
  const nodeTs: Record<string, number> = {};
  const edgeTs: Record<string, number> = {};
  let idc = 0;
  let raf: number | null = null;
  let connection: ConnectionState = "connecting";
  let lastTickAt = 0;
  let buffer = 0;

  const now = () => performance.now();
  const sync = () => setPackets(pks.slice());

  const ensure = () => {
    if (raf == null) raf = requestAnimationFrame(tick);
  };
  const bumpNode = (id: string) => {
    nodeTs[id] = now();
    ensure();
  };
  const bumpEdge = (id: string) => {
    edgeTs[id] = now();
    ensure();
  };
  const activeOn = (edge: string) => pks.reduce((c, p) => c + (p.edge === edge ? 1 : 0), 0);

  function spawn(step: FlowStep, color: string) {
    bumpEdge(step.edge);
    const s = samplersRef.current[step.edge];
    if (!s || s.length === 0 || activeOn(step.edge) >= MAX_PER_EDGE) {
      // no geometry yet or edge saturated — skip the packet but keep the cascade
      (step.then ?? []).forEach((c) => spawn(c, color));
      return;
    }
    pks.push({
      id: idc++,
      edge: step.edge,
      color,
      start: now(),
      dur: clamp(s.length / SPEED, MIN_DUR, MAX_DUR),
      children: step.then ?? [],
    });
    sync();
    ensure();
  }

  function tick() {
    const t = now();
    const done: Packet[] = [];
    for (let i = pks.length - 1; i >= 0; i--) {
      if ((t - pks[i].start) / pks[i].dur >= 1) {
        done.push(pks[i]);
        pks.splice(i, 1);
      }
    }
    for (const p of done) {
      bumpEdge(p.edge);
      bumpNode(EDGE_BY_ID[p.edge].to);
      p.children.forEach((c) => spawn(c, p.color));
    }
    if (done.length) sync();
    setNow(t);

    const anyHeat =
      NODES.some((n) => t - (nodeTs[n.id] ?? -1e9) < DECAY_NODE) ||
      EDGES.some((e) => t - (edgeTs[e.id] ?? -1e9) < DECAY_EDGE);
    if (pks.length > 0 || anyHeat || done.length > 0) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }

  return {
    nodeTs,
    edgeTs,
    setConnection: (c) => {
      connection = c;
    },
    command: () => {
      if (connection === "closed") return;
      bumpNode("browser");
      spawn(COMMAND_FLOW, "var(--color-cyan)");
    },
    event: (type) => {
      if (connection === "closed") return;
      const f = eventFlow(type);
      if (f.signalLost) setBuffer(++buffer);
      if (f.reconnect) {
        buffer = 0;
        setBuffer(0);
      }
      if (f.tick) {
        const t = now();
        if (t - lastTickAt < TICK_COALESCE) {
          // coalesce: keep the main event lanes warm without a packet per tick
          ["worker", "t_events", "ws", "projector", "browser"].forEach(bumpNode);
          ["e_worker_produce", "e_ws_consume", "e_ws_push", "e_proj_consume"].forEach(
            bumpEdge,
          );
          return;
        }
        lastTickAt = t;
      }
      bumpNode("worker");
      spawn(f.steps, "var(--color-teal)");
      if (f.dead) spawn({ edge: "e_dlq" }, "var(--color-red)");
      if (f.telemetry) spawn(TELEMETRY_FLOW, "var(--color-amber)");
    },
    dispose: () => {
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
    },
  };
}

export interface PositionedPacket {
  id: number;
  color: string;
  x: number;
  y: number;
}

export type ReplayStatus = "idle" | "playing" | "paused";

/** Drives the event log back through the flow diagram at a controlled cadence. */
export interface ReplayController {
  status: ReplayStatus;
  index: number; // events played so far
  total: number; // events in the snapshot being replayed
  speed: number; // multiplier; 1 = BASE_DELAY, smaller = slower
  current: MissionEvent | null; // event currently animating
  play: () => void; // start fresh, or resume from a pause
  pause: () => void; // freeze, keeping position
  restart: () => void; // re-snapshot the log and play from the top
  seek: (index: number) => void;
  setSpeed: (speed: number) => void;
}

export interface ArchitectureSignals {
  heatNodes: Record<string, number>;
  heatEdges: Record<string, number>;
  packets: PositionedPacket[];
  outboxBuffering: number;
  connection: ConnectionState;
  replay: ReplayController;
}

export function useArchitectureSignals(): ArchitectureSignals {
  const events = useMissionStore((s) => s.events);
  const connection = useMissionStore((s) => s.connection);

  const [packets, setPackets] = useState<Packet[]>([]);
  const [nowTs, setNowTs] = useState(0);
  const [outboxBuffering, setOutboxBuffering] = useState(0);

  // Samplers need the DOM; activity only happens post-mount, so building them on
  // first client render is sufficient.
  const samplersRef = useRef<Record<string, EdgeSampler>>({});
  if (typeof document !== "undefined" && Object.keys(samplersRef.current).length === 0) {
    samplersRef.current = buildSamplers();
  }

  const engine = useMemo(
    () => createEngine(samplersRef, setPackets, setNowTs, setOutboxBuffering),
    [],
  );

  useEffect(() => engine.setConnection(connection), [connection, engine]);
  useEffect(() => activityBus.onCommand(() => engine.command()), [engine]);
  useEffect(() => () => engine.dispose(), [engine]);

  // --- Replay controller -----------------------------------------------------
  // Re-feeds buffered events through `engine.event` on a timer so the operator
  // can re-watch the pipeline at a slower, readable pace.
  const [replayStatus, setReplayStatus] = useState<ReplayStatus>("idle");
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayTotal, setReplayTotal] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [replayCurrent, setReplayCurrent] = useState<MissionEvent | null>(null);

  const bufferRef = useRef<MissionEvent[]>([]); // chronological snapshot
  const idxRef = useRef(0);
  const speedRef = useRef(1);
  const statusRef = useRef<ReplayStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const replayApi = useMemo(() => {
    const clearTimer = () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const finish = () => {
      clearTimer();
      statusRef.current = "idle";
      setReplayStatus("idle");
      setReplayCurrent(null);
    };
    const step = () => {
      const buf = bufferRef.current;
      if (idxRef.current >= buf.length) {
        finish();
        return;
      }
      const ev = buf[idxRef.current];
      engine.event(ev.type);
      setReplayCurrent(ev);
      idxRef.current += 1;
      setReplayIndex(idxRef.current);
      timerRef.current = setTimeout(step, BASE_DELAY / speedRef.current);
    };
    const snapshot = () => {
      // store keeps events newest-first; reverse → chronological
      const buf = [...eventsRef.current].reverse();
      bufferRef.current = buf;
      idxRef.current = 0;
      setReplayIndex(0);
      setReplayTotal(buf.length);
      return buf;
    };
    return {
      play() {
        if (statusRef.current === "playing") return;
        const buf =
          statusRef.current === "idle" ? snapshot() : bufferRef.current;
        if (buf.length === 0) return;
        statusRef.current = "playing";
        setReplayStatus("playing");
        step();
      },
      pause() {
        clearTimer();
        if (statusRef.current === "playing") {
          statusRef.current = "paused";
          setReplayStatus("paused");
        }
      },
      restart() {
        clearTimer();
        const buf = snapshot();
        setReplayCurrent(null);
        if (buf.length === 0) {
          statusRef.current = "idle";
          setReplayStatus("idle");
          return;
        }
        statusRef.current = "playing";
        setReplayStatus("playing");
        step();
      },
      seek(i: number) {
        const buf = bufferRef.current;
        const clamped = clamp(Math.round(i), 0, buf.length);
        idxRef.current = clamped;
        setReplayIndex(clamped);
        if (statusRef.current === "playing") {
          clearTimer();
          step();
        }
      },
      setSpeed(s: number) {
        speedRef.current = s;
        setReplaySpeed(s);
        if (statusRef.current === "playing" && timerRef.current != null) {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(step, BASE_DELAY / s);
        }
      },
    };
  }, [engine]);

  useEffect(
    () => () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    },
    [],
  );

  // Animate freshly-arrived events. Skip the initial snapshot burst, and only
  // animate events newer than the last head we saw (chronological, capped).
  // While a replay is active, suppress live animation but keep the head pointer
  // current so we don't replay the backlog when it ends.
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (events.length === 0) return;
    if (statusRef.current !== "idle") {
      lastId.current = events[0].id;
      return;
    }
    const head = events[0].id;
    if (lastId.current === null) {
      lastId.current = head;
      return;
    }
    if (head === lastId.current) return;
    const fresh = [];
    for (const e of events) {
      if (e.id === lastId.current) break;
      fresh.push(e);
    }
    lastId.current = head;
    fresh
      .reverse()
      .slice(-MAX_FRESH)
      .forEach((e) => engine.event(e.type));
  }, [events, engine]);

  // Derive heat + packet positions for the current frame.
  const heatNodes: Record<string, number> = {};
  const heatEdges: Record<string, number> = {};
  for (const n of NODES) {
    heatNodes[n.id] = clamp(1 - (nowTs - (engine.nodeTs[n.id] ?? -1e9)) / DECAY_NODE, 0, 1);
  }
  for (const e of EDGES) {
    heatEdges[e.id] = clamp(1 - (nowTs - (engine.edgeTs[e.id] ?? -1e9)) / DECAY_EDGE, 0, 1);
  }
  const positioned: PositionedPacket[] = packets.map((p) => {
    const s = samplersRef.current[p.edge];
    const prog = clamp((nowTs - p.start) / p.dur, 0, 1);
    const pt = s ? s.sample(easeInOut(prog)) : { x: -20, y: -20 };
    return { id: p.id, color: p.color, x: pt.x, y: pt.y };
  });

  const replay: ReplayController = {
    status: replayStatus,
    index: replayIndex,
    total: replayTotal,
    speed: replaySpeed,
    current: replayCurrent,
    ...replayApi,
  };

  return { heatNodes, heatEdges, packets: positioned, outboxBuffering, connection, replay };
}
