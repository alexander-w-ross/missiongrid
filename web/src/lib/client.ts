/**
 * Unified mission client.
 *
 * The rest of the app talks to this interface and never knows whether it is
 * driving the real FastAPI/Kafka backend or the in-browser mock. Swap is
 * controlled by NEXT_PUBLIC_MOCK (see config.ts).
 */
import { httpApi, type CommandAck } from "./api";
import { config } from "./config";
import { mockBackend } from "./mock/mockBackend";
import { createMissionSocket, type SocketHandlers } from "./ws";
import type { ConnectionState, MissionEvent, MissionState } from "./types";

export interface MissionClient {
  isMock: boolean;
  createMission(input: { name: string; width: number; height: number }): Promise<{ mission_id: string }>;
  getMissionState(missionId: string): Promise<MissionState>;
  placeFire(missionId: string, input: { x: number; y: number; intensity: number }): Promise<CommandAck>;
  placeMountain(missionId: string, input: { x: number; y: number }): Promise<CommandAck>;
  removeMountain(missionId: string, x: number, y: number): Promise<CommandAck>;
  createResponder(missionId: string, input: { name: string; x: number; y: number }): Promise<CommandAck>;
  dispatchResponder(missionId: string, responderId: string, input: { fire_id: string }): Promise<CommandAck>;
  moveMissionControl(missionId: string, input: { x: number; y: number }): Promise<CommandAck>;
  resetMission(missionId: string): Promise<CommandAck>;
  /** Subscribe to the live event stream. Returns an unsubscribe function. */
  connect(
    missionId: string,
    handlers: {
      onEvent: (event: MissionEvent) => void;
      onSnapshot?: (state: MissionState) => void;
      onStatus?: (state: ConnectionState) => void;
    },
  ): () => void;
}

const realClient: MissionClient = {
  isMock: false,
  createMission: httpApi.createMission,
  getMissionState: httpApi.getMissionState,
  placeFire: httpApi.placeFire,
  placeMountain: httpApi.placeMountain,
  removeMountain: httpApi.removeMountain,
  createResponder: httpApi.createResponder,
  dispatchResponder: httpApi.dispatchResponder,
  moveMissionControl: httpApi.moveMissionControl,
  resetMission: httpApi.resetMission,
  connect(missionId, handlers) {
    const sockHandlers: SocketHandlers = {
      onEvent: handlers.onEvent,
      onSnapshot: handlers.onSnapshot,
      onStatus: handlers.onStatus,
    };
    const ctrl = createMissionSocket(missionId, sockHandlers);
    return () => ctrl.close();
  },
};

const mockClient: MissionClient = {
  isMock: true,
  createMission: (input) => mockBackend.createMission(input),
  getMissionState: (id) => mockBackend.getMissionState(id),
  placeFire: (id, input) => mockBackend.placeFire(id, input),
  placeMountain: (id, input) => mockBackend.placeMountain(id, input),
  removeMountain: (id, x, y) => mockBackend.removeMountain(id, x, y),
  createResponder: (id, input) => mockBackend.createResponder(id, input),
  dispatchResponder: (id, rid, input) => mockBackend.dispatchResponder(id, rid, input),
  moveMissionControl: (id, input) => mockBackend.moveMissionControl(id, input),
  resetMission: (id) => mockBackend.resetMission(id),
  connect(missionId, handlers) {
    handlers.onStatus?.("mock");
    return mockBackend.subscribe(missionId, handlers.onEvent);
  },
};

export const client: MissionClient = config.mock ? mockClient : realClient;
