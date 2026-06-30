/**
 * Maps the two real signals the browser has — outbound commands and inbound
 * events — onto the topology edges that should light up, expressed as a tree of
 * hops (`FlowStep`). The engine in `useArchitectureSignals` walks these trees,
 * spawning a packet per edge and branching at fan-out points.
 *
 * This is the only place that encodes "which event lights which part of the
 * pipeline", and is the natural seam for a future *real* per-stage telemetry
 * feed: such a feed would bypass these inferred trees and drive edges directly.
 */
import type { MissionEventType } from "@/lib/types";

/** One hop along an edge, optionally branching into further hops on arrival. */
export interface FlowStep {
  edge: string;
  then?: FlowStep[];
}

/** Browser → API → commands topic → simulation worker. Same for every command. */
export const COMMAND_FLOW: FlowStep = {
  edge: "e_http",
  then: [{ edge: "e_api_produce", then: [{ edge: "e_cmd_consume" }] }],
};

/** Reconnect backlog: outbox → telemetry topic → telemetry worker → events. */
export const TELEMETRY_FLOW: FlowStep = {
  edge: "e_outbox_flush",
  then: [
    {
      edge: "e_outbox_produce",
      then: [{ edge: "e_tel_consume", then: [{ edge: "e_tel_produce" }] }],
    },
  ],
};

/** Per-tick events — coalesced rather than spawning a packet each. */
const TICK: Set<MissionEventType> = new Set([
  "RESPONDER_MOVED",
  "FIRE_INTENSITY_CHANGED",
]);

/** Events that represent a structural write (so the projector also hits the ledger). */
const STRUCTURAL: Set<MissionEventType> = new Set([
  "MISSION_CREATED",
  "FIRE_CREATED",
  "RESPONDER_CREATED",
  "MOUNTAIN_PLACED",
  "MOUNTAIN_REMOVED",
  "RESPONDER_DISPATCHED",
  "RESPONDER_PATH_ASSIGNED",
  "FIRE_EXTINGUISHED",
  "MISSION_CONTROL_MOVED",
  "MISSION_RESET",
]);

export interface EventFlow {
  /** worker → events, fanning out to {projector → postgres (+ledger)} and {ws → browser} */
  steps: FlowStep;
  /** high-frequency tick event — caller should coalesce */
  tick: boolean;
  /** light the dead-letter edge in red */
  dead: boolean;
  /** light the telemetry reconnect loop in amber */
  telemetry: boolean;
  /** responder went dark — outbox starts buffering */
  signalLost: boolean;
  /** responder came back — outbox buffer flushes/clears */
  reconnect: boolean;
}

export function eventFlow(type: MissionEventType): EventFlow {
  const structural = STRUCTURAL.has(type);
  const steps: FlowStep = {
    edge: "e_worker_produce",
    then: [
      {
        edge: "e_proj_consume",
        then: [
          {
            edge: "e_proj_write",
            then: structural ? [{ edge: "e_proj_ledger" }] : undefined,
          },
        ],
      },
      { edge: "e_ws_consume", then: [{ edge: "e_ws_push" }] },
    ],
  };
  return {
    steps,
    tick: TICK.has(type),
    dead: type === "ROUTE_NOT_FOUND",
    telemetry:
      type === "RESPONDER_RECONNECTED" || type === "RESPONDER_POSITION_RECONCILED",
    signalLost: type === "SIGNAL_LOST",
    reconnect: type === "RESPONDER_RECONNECTED",
  };
}
