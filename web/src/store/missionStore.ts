/**
 * Mission store.
 *
 * Holds the projected mission state and applies the live event stream. This
 * reducer is the frontend's single source of "how an event changes the view",
 * and it is intentionally identical whether events come from the real Kafka
 * pipeline (via WebSocket) or the in-browser mock.
 */
import { create } from "zustand";
import type {
  ConnectionState,
  Fire,
  MissionEvent,
  MissionState,
  Point,
  Responder,
  Tool,
} from "@/lib/types";

export interface Notice {
  id: string;
  kind: "info" | "warn" | "success";
  message: string;
}

interface MissionStore {
  state: MissionState | null;
  connection: ConnectionState;
  tool: Tool;
  /** Responder selected for inspection or as dispatch source. */
  selectedResponderId: string | null;
  selectedFireId: string | null;
  notice: Notice | null;
  events: MissionEvent[];

  setSnapshot: (state: MissionState) => void;
  applyEvent: (event: MissionEvent) => void;
  setConnection: (c: ConnectionState) => void;
  setTool: (t: Tool) => void;
  selectResponder: (id: string | null) => void;
  selectFire: (id: string | null) => void;
  setNotice: (n: Notice | null) => void;
  reset: () => void;
}

const MAX_EVENTS = 100;

export const useMissionStore = create<MissionStore>((set, get) => ({
  state: null,
  connection: "connecting",
  tool: "select",
  selectedResponderId: null,
  selectedFireId: null,
  notice: null,
  events: [],

  setSnapshot: (state) => set({ state, events: state.recent_events ?? [] }),

  applyEvent: (event) =>
    set((store) => {
      if (!store.state) return store;
      // Drop already-applied events (e.g. a backend that replays history after a
      // WebSocket reconnect) so state and the log can't double-count or collide
      // on React keys.
      if (event.id && store.events.some((e) => e.id === event.id)) return store;
      const next = reduce(store.state, event);
      const notice = noticeFor(event, store.state);
      return {
        state: next,
        events: [event, ...store.events].slice(0, MAX_EVENTS),
        ...(notice ? { notice } : {}),
      };
    }),

  setConnection: (connection) => set({ connection }),
  setTool: (tool) => set({ tool }),
  selectResponder: (selectedResponderId) => set({ selectedResponderId }),
  selectFire: (selectedFireId) => set({ selectedFireId }),
  setNotice: (notice) => set({ notice }),
  reset: () =>
    set({
      state: null,
      events: [],
      selectedResponderId: null,
      selectedFireId: null,
      notice: null,
    }),
}));

// ---------------------------------------------------------------------------
// Event reducer — pure, returns a new MissionState.
// ---------------------------------------------------------------------------

function reduce(state: MissionState, event: MissionEvent): MissionState {
  const p = event.payload as Record<string, any>;

  switch (event.type) {
    case "FIRE_CREATED": {
      const fire = p.fire as Fire;
      if (state.fires.some((f) => f.id === fire.id)) return state;
      return { ...state, fires: [...state.fires, fire] };
    }

    case "MOUNTAIN_PLACED": {
      if (state.cells.some((c) => c.x === p.x && c.y === p.y && c.terrain === "mountain"))
        return state;
      return {
        ...state,
        cells: [...state.cells, { x: p.x, y: p.y, terrain: "mountain" }],
      };
    }

    case "MOUNTAIN_REMOVED":
      return {
        ...state,
        cells: state.cells.filter(
          (c) => !(c.x === p.x && c.y === p.y && c.terrain === "mountain"),
        ),
      };

    case "RESPONDER_CREATED": {
      const responder = p.responder as Responder;
      if (state.responders.some((r) => r.id === responder.id)) return state;
      return { ...state, responders: [...state.responders, responder] };
    }

    case "RESPONDER_DISPATCHED":
      return mapResponder(state, p.responder_id, (r) => ({
        ...r,
        assigned_fire_id: p.fire_id,
        status: "moving",
      }));

    case "RESPONDER_PATH_ASSIGNED":
      return mapResponder(state, p.responder_id, (r) => ({
        ...r,
        path: p.path as Point[],
        path_index: 0,
        status: "moving",
      }));

    case "RESPONDER_MOVED":
      return mapResponder(state, p.responder_id, (r) => ({
        ...r,
        x: p.position?.x ?? r.x,
        y: p.position?.y ?? r.y,
        last_known_x: p.last_known?.x ?? r.last_known_x,
        last_known_y: p.last_known?.y ?? r.last_known_y,
        path_index: p.path_index ?? r.path_index,
        status: p.status ?? r.status,
        signal_status: p.signal_status ?? r.signal_status,
      }));

    case "SIGNAL_LOST":
      return mapResponder(state, p.responder_id, (r) => ({
        ...r,
        signal_status: "blocked",
        last_known_x: p.last_known?.x ?? r.last_known_x,
        last_known_y: p.last_known?.y ?? r.last_known_y,
      }));

    case "SIGNAL_RESTORED":
      return mapResponder(state, p.responder_id, (r) => ({
        ...r,
        signal_status: "connected",
        last_known_x: p.position?.x ?? r.x,
        last_known_y: p.position?.y ?? r.y,
      }));

    case "RESPONDER_RECONNECTED":
      return mapResponder(state, p.responder_id, (r) => ({
        ...r,
        signal_status: "connected",
      }));

    case "RESPONDER_POSITION_RECONCILED":
      return mapResponder(state, p.responder_id, (r) => ({
        ...r,
        x: p.position?.x ?? r.x,
        y: p.position?.y ?? r.y,
        last_known_x: p.position?.x ?? r.last_known_x,
        last_known_y: p.position?.y ?? r.last_known_y,
      }));

    case "FIRE_INTENSITY_CHANGED":
      return mapFire(state, p.fire_id, (f) => ({
        ...f,
        intensity: p.intensity ?? f.intensity,
        status: p.status ?? f.status,
      }));

    case "FIRE_EXTINGUISHED":
      return mapFire(state, p.fire_id, (f) => ({
        ...f,
        intensity: 0,
        status: "extinguished",
      }));

    case "ROUTE_NOT_FOUND":
      return mapResponder(state, p.responder_id, (r) => ({
        ...r,
        status: "idle",
        assigned_fire_id: null,
        path: null,
      }));

    case "MISSION_CONTROL_MOVED":
      return { ...state, mission_control: { x: p.x, y: p.y } };

    case "MISSION_RESET":
      return {
        ...state,
        cells: [],
        fires: [],
        responders: [],
        // The backend owns the post-reset control position; only move the marker
        // if the event carries one, otherwise leave it where it is.
        mission_control: p.mission_control ?? state.mission_control,
      };

    default:
      return state;
  }
}

function mapResponder(
  state: MissionState,
  id: string,
  fn: (r: Responder) => Responder,
): MissionState {
  return {
    ...state,
    responders: state.responders.map((r) => (r.id === id ? fn(r) : r)),
  };
}

function mapFire(
  state: MissionState,
  id: string,
  fn: (f: Fire) => Fire,
): MissionState {
  return {
    ...state,
    fires: state.fires.map((f) => (f.id === id ? fn(f) : f)),
  };
}

function noticeFor(event: MissionEvent, state: MissionState): Notice | null {
  const p = event.payload as Record<string, any>;
  switch (event.type) {
    case "ROUTE_NOT_FOUND": {
      const r = state.responders.find((x) => x.id === p.responder_id);
      return {
        id: event.id,
        kind: "warn",
        message: `No route found for ${r?.name ?? "responder"} — terrain fully blocks the target.`,
      };
    }
    case "FIRE_EXTINGUISHED":
      return { id: event.id, kind: "success", message: "Fire extinguished." };
    case "SIGNAL_LOST": {
      const r = state.responders.find((x) => x.id === p.responder_id);
      return {
        id: event.id,
        kind: "warn",
        message: `Signal lost — ${r?.name ?? "responder"} is behind terrain.`,
      };
    }
    default:
      return null;
  }
}
