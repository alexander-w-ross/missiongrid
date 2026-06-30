/**
 * WebSocket client for live mission events (PRD section 15).
 *
 * Wraps the browser WebSocket with automatic reconnection and exponential
 * backoff so the operator console survives transient drops — itself a small
 * nod to the "reconnection / telemetry replay" themes in the PRD.
 */
import { config } from "./config";
import type { ConnectionState, MissionEvent, MissionState, WebSocketMessage } from "./types";

export interface SocketHandlers {
  onEvent: (event: MissionEvent) => void;
  onSnapshot?: (state: MissionState) => void;
  onError?: (message: string) => void;
  onStatus?: (state: ConnectionState) => void;
}

export interface SocketController {
  close: () => void;
}

export function createMissionSocket(
  missionId: string,
  handlers: SocketHandlers,
): SocketController {
  let ws: WebSocket | null = null;
  let closedByClient = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const url = `${config.wsUrl}/ws/missions/${missionId}`;

  function connect() {
    handlers.onStatus?.("connecting");
    ws = new WebSocket(url);

    ws.onopen = () => {
      attempt = 0;
      handlers.onStatus?.("open");
    };

    ws.onmessage = (ev) => {
      let msg: WebSocketMessage;
      try {
        msg = JSON.parse(ev.data) as WebSocketMessage;
      } catch {
        return;
      }
      if (msg.type === "mission_event") handlers.onEvent(msg.event);
      else if (msg.type === "snapshot") handlers.onSnapshot?.(msg.state);
      else if (msg.type === "error") handlers.onError?.(msg.message);
    };

    ws.onclose = () => {
      handlers.onStatus?.("closed");
      if (closedByClient) return;
      // Exponential backoff capped at 10s.
      const delay = Math.min(10_000, 500 * 2 ** attempt);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return {
    close() {
      closedByClient = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
