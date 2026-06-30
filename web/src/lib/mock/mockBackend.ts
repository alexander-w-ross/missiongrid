/**
 * In-browser MOCK backend.
 *
 * This is the ONLY part of the frontend that runs simulation logic, and it
 * exists purely so the UI is demoable without the FastAPI/Kafka stack. It is
 * activated by NEXT_PUBLIC_MOCK=1 and mirrors the behaviour the real backend
 * will produce (PRD sections 8 & 16): A* dispatch, a 500ms tick that moves
 * responders, line-of-sight signal loss, and fire extinguishing.
 *
 * It mutates an authoritative in-memory MissionState and emits the same event
 * envelopes (PRD 12) the real projector/WebSocket gateway would, so the store
 * reducer that consumes them is identical for mock and real backends.
 */
import { shortId } from "../utils";
import type {
  Fire,
  MissionEvent,
  MissionEventType,
  MissionState,
  Responder,
} from "../types";
import { findPath } from "./pathfinding";
import { hasLineOfSight } from "./lineOfSight";

const TICK_INTERVAL_MS = 500;
const EXTINGUISH_RATE = 5;
const DEFAULT_INTENSITY = 100;
const MAX_RECENT_EVENTS = 50;

type Listener = (event: MissionEvent) => void;

const mkey = (x: number, y: number) => `${x},${y}`;

class MockBackend {
  private missions = new Map<string, MissionState>();
  private listeners = new Map<string, Set<Listener>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  // ---- lifecycle ---------------------------------------------------------

  private ensureTick() {
    if (this.timer || typeof window === "undefined") return;
    this.timer = setInterval(() => this.tickAll(), TICK_INTERVAL_MS);
  }

  private now(): string {
    return new Date().toISOString();
  }

  private emit(missionId: string, type: MissionEventType, payload: Record<string, unknown>) {
    const event: MissionEvent = {
      id: shortId("evt"),
      type,
      schema_version: 1,
      mission_id: missionId,
      actor_id: "mock",
      occurred_at: this.now(),
      payload,
    };
    const state = this.missions.get(missionId);
    if (state) {
      state.recent_events = [event, ...state.recent_events].slice(0, MAX_RECENT_EVENTS);
    }
    this.listeners.get(missionId)?.forEach((fn) => fn(event));
  }

  // ---- subscriptions -----------------------------------------------------

  subscribe(missionId: string, fn: Listener): () => void {
    let set = this.listeners.get(missionId);
    if (!set) {
      set = new Set();
      this.listeners.set(missionId, set);
    }
    set.add(fn);
    this.ensureTick();
    return () => {
      set?.delete(fn);
    };
  }

  // ---- helpers -----------------------------------------------------------

  private mountainSet(state: MissionState): Set<string> {
    const set = new Set<string>();
    for (const cell of state.cells) {
      if (cell.terrain === "mountain") set.add(mkey(cell.x, cell.y));
    }
    return set;
  }

  private inGrid(state: MissionState, x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < state.width && y < state.height;
  }

  // ---- commands ----------------------------------------------------------

  async createMission(input: { name: string; width: number; height: number }) {
    const id = shortId("msn");
    const state: MissionState = {
      mission_id: id,
      name: input.name,
      width: input.width,
      height: input.height,
      status: "active",
      mission_control: { x: -2, y: Math.floor(input.height / 2) },
      cells: [],
      fires: [],
      responders: [],
      recent_events: [],
    };
    this.missions.set(id, state);
    this.emit(id, "MISSION_CREATED", {
      name: input.name,
      width: input.width,
      height: input.height,
    });
    this.ensureTick();
    return { mission_id: id };
  }

  async getMissionState(missionId: string): Promise<MissionState> {
    const state = this.missions.get(missionId);
    if (!state) {
      // Auto-provision a default mission so deep-links / refreshes work in mock.
      const created = await this.createMission({
        name: "Demo Mission",
        width: 20,
        height: 20,
      });
      // Overwrite the generated id with the requested one for stable links.
      const fresh = this.missions.get(created.mission_id)!;
      this.missions.delete(created.mission_id);
      fresh.mission_id = missionId;
      this.missions.set(missionId, fresh);
      return structuredClone(fresh);
    }
    return structuredClone(state);
  }

  async placeFire(missionId: string, input: { x: number; y: number; intensity: number }) {
    const state = this.req(missionId);
    if (!this.inGrid(state, input.x, input.y)) return this.ack();
    if (state.cells.some((c) => c.x === input.x && c.y === input.y && c.terrain === "mountain"))
      return this.ack();
    if (state.fires.some((f) => f.x === input.x && f.y === input.y && f.status !== "extinguished"))
      return this.ack();

    const fire: Fire = {
      id: shortId("fire"),
      x: input.x,
      y: input.y,
      intensity: input.intensity || DEFAULT_INTENSITY,
      status: "active",
    };
    state.fires.push(fire);
    this.emit(missionId, "FIRE_CREATED", { fire });
    return this.ack();
  }

  async placeMountain(missionId: string, input: { x: number; y: number }) {
    const state = this.req(missionId);
    if (!this.inGrid(state, input.x, input.y)) return this.ack();
    if (state.cells.some((c) => c.x === input.x && c.y === input.y && c.terrain === "mountain"))
      return this.ack();
    state.cells.push({ x: input.x, y: input.y, terrain: "mountain" });
    this.emit(missionId, "MOUNTAIN_PLACED", { x: input.x, y: input.y });
    this.recomputeSignals(state);
    return this.ack();
  }

  async removeMountain(missionId: string, x: number, y: number) {
    const state = this.req(missionId);
    const before = state.cells.length;
    state.cells = state.cells.filter(
      (c) => !(c.x === x && c.y === y && c.terrain === "mountain"),
    );
    if (state.cells.length !== before) {
      this.emit(missionId, "MOUNTAIN_REMOVED", { x, y });
      this.recomputeSignals(state);
    }
    return this.ack();
  }

  async createResponder(missionId: string, input: { name: string; x: number; y: number }) {
    const state = this.req(missionId);
    if (!this.inGrid(state, input.x, input.y)) return this.ack();
    const responder: Responder = {
      id: shortId("rsp"),
      name: input.name,
      x: input.x,
      y: input.y,
      last_known_x: input.x,
      last_known_y: input.y,
      status: "idle",
      signal_status: "connected",
      assigned_fire_id: null,
      path: null,
      path_index: 0,
    };
    state.responders.push(responder);
    this.emit(missionId, "RESPONDER_CREATED", { responder });
    this.recomputeSignals(state);
    return this.ack();
  }

  async dispatchResponder(missionId: string, responderId: string, input: { fire_id: string }) {
    const state = this.req(missionId);
    const responder = state.responders.find((r) => r.id === responderId);
    const fire = state.fires.find((f) => f.id === input.fire_id);
    if (!responder || !fire || fire.status === "extinguished") return this.ack();

    responder.assigned_fire_id = fire.id;
    this.emit(missionId, "RESPONDER_DISPATCHED", {
      responder_id: responder.id,
      fire_id: fire.id,
    });

    const path = findPath(
      { x: responder.x, y: responder.y },
      { x: fire.x, y: fire.y },
      state.width,
      state.height,
      this.mountainSet(state),
    );

    if (!path) {
      responder.status = "idle";
      responder.assigned_fire_id = null;
      responder.path = null;
      this.emit(missionId, "ROUTE_NOT_FOUND", {
        responder_id: responder.id,
        fire_id: fire.id,
      });
      return this.ack();
    }

    responder.path = path;
    responder.path_index = 0;
    responder.status = "moving";
    this.emit(missionId, "RESPONDER_PATH_ASSIGNED", {
      responder_id: responder.id,
      path,
    });
    return this.ack();
  }

  async moveMissionControl(missionId: string, input: { x: number; y: number }) {
    const state = this.req(missionId);
    state.mission_control = { x: input.x, y: input.y };
    this.emit(missionId, "MISSION_CONTROL_MOVED", {
      x: input.x,
      y: input.y,
    });
    this.recomputeSignals(state);
    return this.ack();
  }

  async resetMission(missionId: string) {
    const state = this.req(missionId);
    state.cells = [];
    state.fires = [];
    state.responders = [];
    state.mission_control = { x: -2, y: Math.floor(state.height / 2) };
    this.emit(missionId, "MISSION_RESET", { mission_control: state.mission_control });
    return this.ack();
  }

  // ---- tick --------------------------------------------------------------

  private tickAll() {
    for (const [missionId, state] of this.missions) {
      if (this.listeners.get(missionId)?.size) this.tick(missionId, state);
    }
  }

  private tick(missionId: string, state: MissionState) {
    this.moveResponders(missionId, state);
    this.recomputeSignals(state, missionId);
    this.applyFire(missionId, state);
  }

  private moveResponders(missionId: string, state: MissionState) {
    for (const r of state.responders) {
      if (r.status !== "moving" || !r.path) continue;
      if (r.path_index >= r.path.length - 1) {
        // Arrived.
        const fire = state.fires.find((f) => f.id === r.assigned_fire_id);
        r.status = fire && fire.x === r.x && fire.y === r.y ? "fighting_fire" : "idle";
        this.emitMove(missionId, state, r);
        continue;
      }
      r.path_index += 1;
      const next = r.path[r.path_index];
      r.x = next.x;
      r.y = next.y;
      if (r.path_index >= r.path.length - 1) {
        const fire = state.fires.find((f) => f.id === r.assigned_fire_id);
        r.status = fire && fire.x === r.x && fire.y === r.y ? "fighting_fire" : "idle";
      }
      this.emitMove(missionId, state, r);
    }
  }

  /** Emit a move, freezing last-known position while signal is blocked. */
  private emitMove(missionId: string, state: MissionState, r: Responder) {
    if (r.signal_status === "connected") {
      r.last_known_x = r.x;
      r.last_known_y = r.y;
    }
    this.emit(missionId, "RESPONDER_MOVED", {
      responder_id: r.id,
      position: { x: r.x, y: r.y },
      last_known: { x: r.last_known_x, y: r.last_known_y },
      path_index: r.path_index,
      status: r.status,
      signal_status: r.signal_status,
    });
  }

  private recomputeSignals(state: MissionState, missionId = state.mission_id) {
    const mountains = this.mountainSet(state);
    for (const r of state.responders) {
      const los = hasLineOfSight(
        state.mission_control,
        { x: r.x, y: r.y },
        mountains,
        state.width,
        state.height,
      );
      const wasBlocked = r.signal_status === "blocked";
      if (!los.hasLineOfSight && !wasBlocked) {
        // Freeze the mission-control view at the moment of loss.
        r.signal_status = "blocked";
        this.emit(missionId, "SIGNAL_LOST", {
          responder_id: r.id,
          last_known: { x: r.last_known_x, y: r.last_known_y },
          blocked_by: los.blockedBy,
        });
      } else if (los.hasLineOfSight && wasBlocked) {
        r.signal_status = "connected";
        r.last_known_x = r.x;
        r.last_known_y = r.y;
        this.emit(missionId, "SIGNAL_RESTORED", {
          responder_id: r.id,
          position: { x: r.x, y: r.y },
        });
      }
    }
  }

  private applyFire(missionId: string, state: MissionState) {
    for (const fire of state.fires) {
      if (fire.status === "extinguished") continue;
      const crew = state.responders.filter(
        (r) => r.x === fire.x && r.y === fire.y && r.status === "fighting_fire",
      ).length;
      if (crew === 0) continue;

      const next = Math.max(0, fire.intensity - crew * EXTINGUISH_RATE);
      if (next === fire.intensity) continue;
      fire.intensity = next;

      if (next === 0) {
        fire.status = "extinguished";
        this.emit(missionId, "FIRE_INTENSITY_CHANGED", {
          fire_id: fire.id,
          intensity: 0,
          status: "extinguished",
        });
        this.emit(missionId, "FIRE_EXTINGUISHED", { fire_id: fire.id });
        // Stand crews down.
        for (const r of state.responders) {
          if (r.assigned_fire_id === fire.id) {
            r.status = "idle";
            r.assigned_fire_id = null;
            r.path = null;
            this.emitMove(missionId, state, r);
          }
        }
      } else {
        this.emit(missionId, "FIRE_INTENSITY_CHANGED", {
          fire_id: fire.id,
          intensity: next,
          status: fire.status,
        });
      }
    }
  }

  // ---- misc --------------------------------------------------------------

  private req(missionId: string): MissionState {
    const state = this.missions.get(missionId);
    if (!state) throw new Error(`Unknown mission ${missionId}`);
    return state;
  }

  private ack() {
    return { command_id: shortId("cmd") };
  }
}

// Survive Next.js fast-refresh by stashing the singleton on globalThis.
const globalRef = globalThis as unknown as { __missionMock?: MockBackend };
export const mockBackend = globalRef.__missionMock ?? new MockBackend();
if (typeof window !== "undefined") globalRef.__missionMock = mockBackend;
