"use client";

import { useEffect } from "react";
import { client } from "@/lib/client";
import { useMissionStore } from "@/store/missionStore";

/**
 * Loads the initial snapshot for a mission and keeps the store synced to the
 * live event stream for as long as the component is mounted.
 */
export function useMissionConnection(missionId: string) {
  const setSnapshot = useMissionStore((s) => s.setSnapshot);
  const applyEvent = useMissionStore((s) => s.applyEvent);
  const setConnection = useMissionStore((s) => s.setConnection);
  const setNotice = useMissionStore((s) => s.setNotice);
  const reset = useMissionStore((s) => s.reset);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    (async () => {
      // POST /missions is asynchronous (command -> worker -> projector), so the
      // very first GET after navigation can race ahead of the projector and
      // 404. Retry with backoff before surfacing an error; the WebSocket may
      // also deliver a snapshot once the mission exists.
      const MAX_ATTEMPTS = 6;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS && active; attempt++) {
        try {
          const snapshot = await client.getMissionState(missionId);
          if (!active) return;
          setSnapshot(snapshot);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < MAX_ATTEMPTS - 1) {
            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          }
        }
      }

      if (!active) return;
      if (lastErr) {
        setNotice({
          id: "load-error",
          kind: "warn",
          message:
            lastErr instanceof Error
              ? `Could not load mission: ${lastErr.message}`
              : "Could not load mission.",
        });
      }

      // Subscribe regardless: a backend that pushes a snapshot on connect will
      // populate state even if the initial GET never succeeded.
      unsubscribe = client.connect(missionId, {
        onEvent: applyEvent,
        onSnapshot: setSnapshot,
        onStatus: setConnection,
      });
    })();

    return () => {
      active = false;
      unsubscribe();
      reset();
    };
  }, [missionId, setSnapshot, applyEvent, setConnection, setNotice, reset]);
}
