"use client";

/**
 * Tactical-display state selector with time-travel.
 *
 * Returns the live folded state normally. When a replay cursor is set, it
 * reconstructs the mission state *as of that event* by folding the retained base
 * snapshot forward through the timeline up to (and including) the cursor event —
 * reusing the same pure `reduce` the live stream uses, so a replayed frame is
 * byte-for-byte what the operator saw at that moment.
 */
import { useMemo } from "react";
import type { MissionState } from "@/lib/types";
import { reduce, useMissionStore } from "@/store/missionStore";

export function useTacticalState(): MissionState | null {
  const live = useMissionStore((s) => s.state);
  const base = useMissionStore((s) => s.baseState);
  const timeline = useMissionStore((s) => s.timeline);
  const cursor = useMissionStore((s) => s.replayCursor);

  return useMemo(() => {
    if (!cursor || !base) return live;
    const idx = timeline.findIndex((e) => e.id === cursor.id);
    // Cursor event predates the retained base (trimmed out of the timeline) —
    // show the earliest state we can still reconstruct.
    if (idx < 0) return base;
    let s = base;
    for (let i = 0; i <= idx; i++) s = reduce(s, timeline[i]);
    return s;
  }, [cursor, base, timeline, live]);
}
