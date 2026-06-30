/**
 * Shared types mirroring the backend contract in PRD sections 8, 12, 14 & 15.
 *
 * The frontend treats these as the source of truth's shape — it renders them
 * and applies events to them, but never derives simulation outcomes itself
 * (outside of src/lib/mock, which stands in for the backend during dev).
 */

export type Point = { x: number; y: number };

export type Terrain = "empty" | "mountain";

export type FireStatus = "active" | "contained" | "extinguished";

export type ResponderStatus =
  | "idle"
  | "moving"
  | "fighting_fire"
  | "returning"
  | "disconnected";

export type SignalStatus = "connected" | "blocked" | "reconnecting";

export type MissionStatus = "active" | "completed" | "archived";

export interface Cell {
  x: number;
  y: number;
  terrain: Terrain;
}

export interface Fire {
  id: string;
  x: number;
  y: number;
  intensity: number;
  status: FireStatus;
}

export interface Responder {
  id: string;
  name: string;
  x: number;
  y: number;
  last_known_x: number;
  last_known_y: number;
  status: ResponderStatus;
  signal_status: SignalStatus;
  assigned_fire_id: string | null;
  path: Point[] | null;
  path_index: number;
}

export interface MissionControl {
  x: number;
  y: number;
}

/** The shape returned by GET /missions/{id} (PRD 14.3 / 18.14). */
export interface MissionState {
  mission_id: string;
  name: string;
  width: number;
  height: number;
  status: MissionStatus;
  mission_control: MissionControl;
  cells: Cell[];
  fires: Fire[];
  responders: Responder[];
  recent_events: MissionEvent[];
}

/** Event envelope per PRD section 12. */
export interface MissionEvent {
  id: string;
  type: MissionEventType;
  schema_version?: number;
  mission_id: string;
  actor_id?: string;
  correlation_id?: string;
  causation_id?: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export type MissionEventType =
  | "MISSION_CREATED"
  | "FIRE_CREATED"
  | "MOUNTAIN_PLACED"
  | "MOUNTAIN_REMOVED"
  | "RESPONDER_CREATED"
  | "RESPONDER_DISPATCHED"
  | "RESPONDER_PATH_ASSIGNED"
  | "RESPONDER_MOVED"
  | "SIGNAL_LOST"
  | "SIGNAL_RESTORED"
  | "FIRE_INTENSITY_CHANGED"
  | "FIRE_EXTINGUISHED"
  | "RESPONDER_RECONNECTED"
  | "RESPONDER_POSITION_RECONCILED"
  | "ROUTE_NOT_FOUND"
  | "MISSION_CONTROL_MOVED"
  | "MISSION_RESET";

/** Server-to-client WebSocket message (PRD 15). */
export type WebSocketMessage =
  | { type: "mission_event"; event: MissionEvent }
  | { type: "snapshot"; state: MissionState }
  | { type: "error"; message: string };

/** Editor tools available in the toolbar. */
export type Tool =
  | "select"
  | "fire"
  | "mountain"
  | "remove_mountain"
  | "responder"
  | "dispatch"
  | "mission_control";

export type ConnectionState = "connecting" | "open" | "closed" | "mock";
