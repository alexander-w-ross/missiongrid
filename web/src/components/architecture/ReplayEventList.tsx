"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ReplayController } from "@/hooks/useArchitectureSignals";
import { describe, short, TONE, TONE_CLASS } from "@/lib/eventFormat";
import { cn, formatClock } from "@/lib/utils";
import { useMissionStore } from "@/store/missionStore";

/**
 * Chronological mini event log shown beneath the expanded flow diagram. It
 * mirrors the main Event Log but highlights and auto-scrolls to the event
 * currently being replayed, tying the animation to a readable timeline.
 */
export function ReplayEventList({ replay }: { replay: ReplayController }) {
  const events = useMissionStore((s) => s.events);
  const state = useMissionStore((s) => s.state);
  // store keeps events newest-first; show chronological so the highlight walks down
  const ordered = useMemo(() => [...events].reverse(), [events]);

  const currentId = replay.current?.id ?? null;
  const activeRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  if (ordered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center font-mono text-[11px] text-[color:var(--color-faint)]">
        Awaiting telemetry…
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px] scanlines">
      {ordered.map((e) => {
        const active = e.id === currentId;
        const tone = TONE[e.type] ?? "muted";
        return (
          <li
            key={e.id}
            ref={active ? activeRef : null}
            className={cn(
              "flex gap-2 border-b border-[color:var(--color-line)]/50 px-3 py-1.5 leading-tight transition-colors",
              active && "bg-[color:var(--color-cyan)]/10",
            )}
          >
            <span className="w-3 shrink-0 text-[color:var(--color-cyan)]">
              {active ? "▸" : ""}
            </span>
            <span className="shrink-0 tabular-nums text-[color:var(--color-faint)]">
              {formatClock(e.occurred_at)}
            </span>
            <span
              className={cn(
                "shrink-0 font-semibold uppercase",
                TONE_CLASS[tone],
              )}
            >
              {short(e.type)}
            </span>
            <span className="truncate text-[color:var(--color-muted)]">
              {describe(e, state)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
