"use client";

import { useMemo, useRef, useState } from "react";
import { useMissionActions } from "@/hooks/useMissionActions";
import { useTacticalState } from "@/hooks/useTacticalState";
import { CELL, cellCenter, cellTopLeft, fieldSize, pxToCell } from "@/lib/grid";
import type { Fire, MissionState, Responder, Tool } from "@/lib/types";
import { useMissionStore } from "@/store/missionStore";
import { MissionControlMarker } from "./MissionControlMarker";

const key = (x: number, y: number) => `${x},${y}`;

export function MissionGrid({ missionId }: { missionId: string }) {
  // Reconstructed past state while replaying, otherwise the live folded state.
  const state = useTacticalState();
  const replaying = useMissionStore((s) => s.replayCursor) != null;
  const tool = useMissionStore((s) => s.tool);
  const selectedResponderId = useMissionStore((s) => s.selectedResponderId);
  const selectedFireId = useMissionStore((s) => s.selectedFireId);
  const selectResponder = useMissionStore((s) => s.selectResponder);
  const selectFire = useMissionStore((s) => s.selectFire);
  const actions = useMissionActions(missionId);

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const derived = useMemo(() => buildDerived(state), [state]);

  if (!state) return null;
  const { width, height } = state;
  const { w, h } = fieldSize(width, height);

  function eventToCell(e: React.MouseEvent): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const loc = pt.matrixTransform(ctm.inverse());
    return pxToCell(loc.x, loc.y);
  }

  function cellMeta(x: number, y: number) {
    const inGrid = x >= 0 && y >= 0 && x < width && y < height;
    const mountain = derived.mountains.has(key(x, y));
    const fire = state!.fires.find(
      (f) => f.x === x && f.y === y && f.status !== "extinguished",
    );
    const responder = state!.responders.find(
      (r) =>
        (r.x === x && r.y === y) ||
        (r.last_known_x === x && r.last_known_y === y),
    );
    return { inGrid, mountain, fire, responder };
  }

  function handleClick(e: React.MouseEvent) {
    const cell = eventToCell(e);
    if (!cell) return;
    const { x, y } = cell;
    const { inGrid, mountain, fire, responder } = cellMeta(x, y);

    switch (tool) {
      case "fire":
        if (inGrid && !mountain) actions.placeFire(x, y);
        break;
      case "mountain":
        if (inGrid && !mountain && !fire && !responder) actions.placeMountain(x, y);
        break;
      case "remove_mountain":
        if (mountain) actions.removeMountain(x, y);
        break;
      case "responder":
        if (inGrid && !mountain && !fire)
          actions.createResponder(`R-${state!.responders.length + 1}`, x, y);
        break;
      case "mission_control":
        actions.moveMissionControl(x, y);
        break;
      case "dispatch":
        if (responder) selectResponder(responder.id);
        else if (fire && selectedResponderId)
          actions.dispatchResponder(selectedResponderId, fire.id);
        else selectResponder(null);
        break;
      case "select":
      default:
        if (responder) {
          selectResponder(responder.id);
          selectFire(null);
        } else if (fire) {
          selectFire(fire.id);
          selectResponder(null);
        } else {
          selectResponder(null);
          selectFire(null);
        }
    }
  }

  const cursor = replaying
    ? "cursor-default"
    : tool === "select"
      ? "cursor-pointer"
      : "cursor-crosshair";

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} ${h}`}
      className={`h-full w-full touch-none select-none ${cursor}`}
      onClick={handleClick}
      onMouseMove={(e) => {
        // While replaying the tactical view is read-only — no placement preview.
        if (replaying) return;
        const cell = eventToCell(e);
        // Only re-render when the hovered cell actually changes.
        setHover((prev) =>
          cell && prev && prev.x === cell.x && prev.y === cell.y ? prev : cell,
        );
      }}
      onMouseLeave={() => setHover(null)}
      role="application"
      aria-label="Mission grid — interactive tactical map (mouse-driven; tool actions also available from the toolbar)"
      tabIndex={0}
    >
      <defs>
        <radialGradient id="mg-fire" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-fire-core)" />
          <stop offset="45%" stopColor="var(--color-fire)" />
          <stop offset="100%" stopColor="var(--color-red)" stopOpacity="0" />
        </radialGradient>
        <filter id="mg-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern
          id="mg-hatch"
          width="6"
          height="6"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="6" height="6" fill="var(--color-mountain)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-mountain-edge)" strokeWidth="1.4" />
        </pattern>
      </defs>

      {/* gutter backdrop */}
      <rect x={0} y={0} width={w} height={h} fill="var(--color-base)" />

      {/* playable field */}
      <FieldGrid width={width} height={height} />

      {/* coordinate ticks */}
      <CoordTicks width={width} height={height} />

      {/* terrain */}
      {state.cells
        .filter((c) => c.terrain === "mountain")
        .map((c) => {
          const { px, py } = cellTopLeft(c.x, c.y);
          return (
            <g key={`m-${c.x}-${c.y}`}>
              <rect
                x={px + 1}
                y={py + 1}
                width={CELL - 2}
                height={CELL - 2}
                fill="url(#mg-hatch)"
                stroke="var(--color-mountain-edge)"
                strokeWidth={1}
              />
            </g>
          );
        })}

      {/* assigned paths */}
      {state.responders.map((r) =>
        r.path && r.status === "moving" ? (
          <ResponderPath key={`p-${r.id}`} responder={r} />
        ) : null,
      )}

      {/* line-of-sight rays */}
      {state.responders.map((r) => (
        <LineOfSightRay key={`los-${r.id}`} responder={r} state={state} />
      ))}

      {/* fires */}
      {state.fires.map((f) => (
        <FireMarker
          key={f.id}
          fire={f}
          selected={f.id === selectedFireId}
        />
      ))}

      {/* responders */}
      {state.responders.map((r) => (
        <ResponderMarker
          key={r.id}
          responder={r}
          selected={r.id === selectedResponderId}
        />
      ))}

      {/* mission control */}
      <MissionControlMarker
        cx={cellCenter(state.mission_control.x, state.mission_control.y).cx}
        cy={cellCenter(state.mission_control.x, state.mission_control.y).cy}
      />

      {/* hover placement preview */}
      {hover && !replaying && (
        <HoverPreview tool={tool} cell={hover} meta={cellMeta(hover.x, hover.y)} />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------

function buildDerived(state: MissionState | null) {
  const mountains = new Set<string>();
  if (state) {
    for (const c of state.cells) {
      if (c.terrain === "mountain") mountains.add(key(c.x, c.y));
    }
  }
  return { mountains };
}

function FieldGrid({ width, height }: { width: number; height: number }) {
  const { px: ox, py: oy } = cellTopLeft(0, 0);
  const lines = [];
  for (let i = 0; i <= width; i++) {
    const x = ox + i * CELL;
    lines.push(
      <line
        key={`v${i}`}
        x1={x}
        y1={oy}
        x2={x}
        y2={oy + height * CELL}
        stroke="var(--color-line)"
        strokeWidth={i % 5 === 0 ? 1 : 0.5}
        opacity={i % 5 === 0 ? 0.9 : 0.55}
      />,
    );
  }
  for (let j = 0; j <= height; j++) {
    const y = oy + j * CELL;
    lines.push(
      <line
        key={`h${j}`}
        x1={ox}
        y1={y}
        x2={ox + width * CELL}
        y2={y}
        stroke="var(--color-line)"
        strokeWidth={j % 5 === 0 ? 1 : 0.5}
        opacity={j % 5 === 0 ? 0.9 : 0.55}
      />,
    );
  }
  return (
    <>
      <rect
        x={ox}
        y={oy}
        width={width * CELL}
        height={height * CELL}
        fill="var(--color-base-2)"
        stroke="var(--color-line-bright)"
        strokeWidth={1.5}
      />
      {lines}
    </>
  );
}

function CoordTicks({ width, height }: { width: number; height: number }) {
  const ticks = [];
  for (let i = 0; i < width; i += 5) {
    const { cx } = cellCenter(i, 0);
    ticks.push(
      <text
        key={`tx${i}`}
        x={cx}
        y={cellTopLeft(0, 0).py - 6}
        textAnchor="middle"
        fontSize={8}
        fontFamily="var(--font-mono)"
        fill="var(--color-faint)"
      >
        {i}
      </text>,
    );
  }
  for (let j = 0; j < height; j += 5) {
    const { cy } = cellCenter(0, j);
    ticks.push(
      <text
        key={`ty${j}`}
        x={cellTopLeft(0, 0).px - 7}
        y={cy + 3}
        textAnchor="middle"
        fontSize={8}
        fontFamily="var(--font-mono)"
        fill="var(--color-faint)"
      >
        {j}
      </text>,
    );
  }
  return <>{ticks}</>;
}

function ResponderPath({ responder }: { responder: Responder }) {
  if (!responder.path) return null;
  const remaining = responder.path.slice(Math.max(0, responder.path_index));
  if (remaining.length < 2) return null;
  const pts = remaining
    .map((p) => {
      const { cx, cy } = cellCenter(p.x, p.y);
      return `${cx},${cy}`;
    })
    .join(" ");
  return (
    <polyline
      points={pts}
      fill="none"
      stroke="var(--color-cyan)"
      strokeWidth={1.4}
      strokeDasharray="2 4"
      opacity={0.5}
      strokeLinecap="round"
    />
  );
}

function LineOfSightRay({
  responder,
  state,
}: {
  responder: Responder;
  state: MissionState;
}) {
  const mc = cellCenter(state.mission_control.x, state.mission_control.y);
  const blocked = responder.signal_status === "blocked";
  // Connected → ray to true position. Blocked → ray to last-known (stale view).
  const target = blocked
    ? cellCenter(responder.last_known_x, responder.last_known_y)
    : cellCenter(responder.x, responder.y);
  return (
    <line
      x1={mc.cx}
      y1={mc.cy}
      x2={target.cx}
      y2={target.cy}
      stroke={blocked ? "var(--color-red)" : "var(--color-teal)"}
      strokeWidth={blocked ? 1 : 0.9}
      strokeDasharray={blocked ? "3 4" : undefined}
      opacity={blocked ? 0.5 : 0.32}
    />
  );
}

const RESPONDER_COLOR: Record<string, string> = {
  idle: "var(--color-muted)",
  moving: "var(--color-cyan)",
  fighting_fire: "var(--color-amber)",
  returning: "var(--color-cyan)",
  disconnected: "var(--color-red)",
};

function ResponderMarker({
  responder,
  selected,
}: {
  responder: Responder;
  selected: boolean;
}) {
  const blocked = responder.signal_status === "blocked";
  const color = RESPONDER_COLOR[responder.status] ?? "var(--color-cyan)";
  const r = CELL * 0.3;
  const true_ = cellCenter(responder.x, responder.y);
  const known = cellCenter(responder.last_known_x, responder.last_known_y);

  return (
    <g>
      {/* ghost at true position when mission control has lost the unit */}
      {blocked && (
        <g
          style={{
            transform: `translate(${true_.cx}px, ${true_.cy}px)`,
            transition: "transform 0.4s linear",
          }}
        >
          <circle r={r} fill="none" stroke="var(--color-cyan)" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
          <circle r={2} fill="var(--color-cyan)" opacity={0.6} />
        </g>
      )}

      {/* official marker (last-known when blocked, else live) */}
      <g
        style={{
          transform: `translate(${blocked ? known.cx : true_.cx}px, ${blocked ? known.cy : true_.cy}px)`,
          transition: "transform 0.4s linear",
        }}
      >
        {selected && (
          <circle r={r + 5} fill="none" stroke="var(--color-teal)" strokeWidth={1} opacity={0.9} />
        )}
        <circle r={r + 2.5} fill={color} opacity={0.12} />
        <circle
          r={r}
          fill="var(--color-base)"
          stroke={blocked ? "var(--color-red)" : color}
          strokeWidth={2}
          strokeDasharray={blocked ? "3 2" : undefined}
          filter="url(#mg-glow)"
        />
        <text
          textAnchor="middle"
          dy={3}
          fontSize={8}
          fontFamily="var(--font-mono)"
          fontWeight={600}
          fill={blocked ? "var(--color-red)" : color}
        >
          {responder.name.replace(/[^0-9]/g, "") || responder.name.slice(0, 2)}
        </text>
      </g>
    </g>
  );
}

function FireMarker({ fire, selected }: { fire: Fire; selected: boolean }) {
  const { cx, cy } = cellCenter(fire.x, fire.y);
  const extinguished = fire.status === "extinguished";
  const frac = Math.max(0, Math.min(1, fire.intensity / 100));
  const ringR = CELL * 0.42;
  const circ = 2 * Math.PI * ringR;

  if (extinguished) {
    return (
      <g transform={`translate(${cx}, ${cy})`} opacity={0.55}>
        <circle r={CELL * 0.28} fill="none" stroke="var(--color-faint)" strokeWidth={1.2} strokeDasharray="2 2" />
        <line x1={-4} y1={-4} x2={4} y2={4} stroke="var(--color-faint)" strokeWidth={1.2} />
        <line x1={4} y1={-4} x2={-4} y2={4} stroke="var(--color-faint)" strokeWidth={1.2} />
      </g>
    );
  }

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {selected && (
        <circle r={ringR + 5} fill="none" stroke="var(--color-teal)" strokeWidth={1} />
      )}
      {/* pulsing heat */}
      <circle r={CELL * 0.5} fill="url(#mg-fire)">
        <animate
          attributeName="opacity"
          values="0.55;0.95;0.55"
          dur="1.6s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="r"
          values={`${CELL * 0.42};${CELL * 0.54};${CELL * 0.42}`}
          dur="1.6s"
          repeatCount="indefinite"
        />
      </circle>
      <circle r={CELL * 0.22} fill="var(--color-fire-core)" filter="url(#mg-glow)" />
      {/* intensity ring */}
      <circle
        r={ringR}
        fill="none"
        stroke="var(--color-fire)"
        strokeWidth={2}
        strokeDasharray={`${circ * frac} ${circ}`}
        transform="rotate(-90)"
        opacity={0.9}
        strokeLinecap="round"
      />
      <text
        textAnchor="middle"
        dy={3}
        fontSize={8}
        fontFamily="var(--font-mono)"
        fontWeight={600}
        fill="#1a0c00"
      >
        {Math.round(fire.intensity)}
      </text>
    </g>
  );
}

function HoverPreview({
  tool,
  cell,
  meta,
}: {
  tool: Tool;
  cell: { x: number; y: number };
  meta: { inGrid: boolean; mountain: boolean; fire?: Fire; responder?: Responder };
}) {
  if (tool === "select") return null;
  const { px, py } = cellTopLeft(cell.x, cell.y);
  const { cx, cy } = cellCenter(cell.x, cell.y);

  let valid = false;
  let color = "var(--color-teal)";
  switch (tool) {
    case "fire":
      valid = meta.inGrid && !meta.mountain;
      color = "var(--color-fire)";
      break;
    case "mountain":
      valid = meta.inGrid && !meta.mountain && !meta.fire && !meta.responder;
      color = "var(--color-mountain-edge)";
      break;
    case "remove_mountain":
      valid = meta.mountain;
      color = "var(--color-red)";
      break;
    case "responder":
      valid = meta.inGrid && !meta.mountain && !meta.fire;
      color = "var(--color-cyan)";
      break;
    case "mission_control":
      valid = true;
      color = "var(--color-mc)";
      break;
    case "dispatch":
      valid = !!meta.responder || !!meta.fire;
      color = "var(--color-teal)";
      break;
  }

  return (
    <g pointerEvents="none">
      <rect
        x={px + 1}
        y={py + 1}
        width={CELL - 2}
        height={CELL - 2}
        fill={valid ? color : "var(--color-red)"}
        opacity={valid ? 0.14 : 0.08}
        stroke={valid ? color : "var(--color-red)"}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {tool === "mission_control" && (
        <circle cx={cx} cy={cy} r={3} fill="var(--color-mc)" opacity={0.8} />
      )}
    </g>
  );
}
