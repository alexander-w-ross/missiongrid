"use client";

import { useCallback, useMemo } from "react";
import { activityBus } from "@/lib/activityBus";
import { client } from "@/lib/client";
import { useMissionStore } from "@/store/missionStore";

/**
 * Command surface bound to a mission id. Each call fires a backend command;
 * resulting state arrives via the event stream. Errors are surfaced as notices.
 */
export function useMissionActions(missionId: string) {
  const setNotice = useMissionStore((s) => s.setNotice);

  const guard = useCallback(
    async <T>(
      fn: () => Promise<T>,
      label: string,
      command: string,
    ): Promise<T | undefined> => {
      // Block commands while the tactical view is showing a past (replayed) state —
      // they'd act against positions that no longer match the live mission.
      if (useMissionStore.getState().replayCursor != null) {
        setNotice({
          id: "replay-locked",
          kind: "warn",
          message: "Controls locked during replay — return to live to act.",
        });
        return undefined;
      }
      // Announce the command the instant it's fired so the data-flow view can
      // animate the command half of the pipeline immediately (its effects come
      // back later as events on the live stream).
      activityBus.emitCommand(command);
      try {
        return await fn();
      } catch (err) {
        setNotice({
          id: `err-${label}`,
          kind: "warn",
          message:
            err instanceof Error ? `${label} failed: ${err.message}` : `${label} failed.`,
        });
        return undefined;
      }
    },
    [setNotice],
  );

  return useMemo(
    () => ({
      placeFire: (x: number, y: number, intensity = 100) =>
        guard(
          () => client.placeFire(missionId, { x, y, intensity }),
          "Place fire",
          "PLACE_FIRE",
        ),
      placeMountain: (x: number, y: number) =>
        guard(
          () => client.placeMountain(missionId, { x, y }),
          "Place mountain",
          "PLACE_MOUNTAIN",
        ),
      removeMountain: (x: number, y: number) =>
        guard(
          () => client.removeMountain(missionId, x, y),
          "Remove mountain",
          "REMOVE_MOUNTAIN",
        ),
      createResponder: (name: string, x: number, y: number) =>
        guard(
          () => client.createResponder(missionId, { name, x, y }),
          "Create responder",
          "CREATE_RESPONDER",
        ),
      dispatchResponder: (responderId: string, fireId: string) =>
        guard(
          () => client.dispatchResponder(missionId, responderId, { fire_id: fireId }),
          "Dispatch",
          "DISPATCH_RESPONDER",
        ),
      moveMissionControl: (x: number, y: number) =>
        guard(
          () => client.moveMissionControl(missionId, { x, y }),
          "Move mission control",
          "MOVE_MISSION_CONTROL",
        ),
      resetMission: () =>
        guard(() => client.resetMission(missionId), "Reset mission", "RESET_MISSION"),
    }),
    [guard, missionId],
  );
}
