/**
 * Thin HTTP client for the FastAPI backend (PRD section 14).
 *
 * Every write returns an accepted command id; the resulting state arrives
 * asynchronously via the projector + WebSocket. The UI therefore treats these
 * calls as "fire the command" and waits for events, rather than using the
 * response body as the new state.
 */
import { config } from "./config";
import type { MissionState } from "./types";

export interface CommandAck {
  command_id?: string;
  correlation_id?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (cause) {
    throw new ApiError(
      `Network error reaching ${config.apiUrl}${path}. Is the backend running?`,
      0,
      { cause },
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = (body?.detail as string) ?? detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const httpApi = {
  health: () => request<{ ok: boolean }>("/health"),

  createMission: (input: { name: string; width: number; height: number }) =>
    request<{ mission_id: string }>("/missions", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getMissionState: (missionId: string) =>
    request<MissionState>(`/missions/${missionId}`),

  placeFire: (
    missionId: string,
    input: { x: number; y: number; intensity: number },
  ) =>
    request<CommandAck>(`/missions/${missionId}/fires`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  placeMountain: (missionId: string, input: { x: number; y: number }) =>
    request<CommandAck>(`/missions/${missionId}/mountains`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  removeMountain: (missionId: string, x: number, y: number) =>
    request<CommandAck>(`/missions/${missionId}/mountains/${x}/${y}`, {
      method: "DELETE",
    }),

  createResponder: (
    missionId: string,
    input: { name: string; x: number; y: number },
  ) =>
    request<CommandAck>(`/missions/${missionId}/responders`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  dispatchResponder: (
    missionId: string,
    responderId: string,
    input: { fire_id: string },
  ) =>
    request<CommandAck>(
      `/missions/${missionId}/responders/${responderId}/dispatch`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  moveMissionControl: (missionId: string, input: { x: number; y: number }) =>
    request<CommandAck>(`/missions/${missionId}/mission-control/move`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  resetMission: (missionId: string) =>
    request<CommandAck>(`/missions/${missionId}/reset`, { method: "POST" }),
};
