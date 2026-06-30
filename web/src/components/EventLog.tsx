"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import type { MissionEvent, MissionState } from "@/lib/types";
import { describe, NOISY, short, TONE, TONE_CLASS } from "@/lib/eventFormat";
import { cn, formatClock } from "@/lib/utils";
import { useMissionStore } from "@/store/missionStore";
import { Panel } from "./Panel";

export function EventLog() {
  const events = useMissionStore((s) => s.events);
  const state = useMissionStore((s) => s.state);
  const [verbose, setVerbose] = useState(false);

  const shown = verbose ? events : events.filter((e) => !NOISY.has(e.type));

  return (
    <Panel
      title="Event Log"
      icon={<ScrollText className="h-4 w-4" strokeWidth={2} />}
      action={
        <button
          onClick={() => setVerbose((v) => !v)}
          className={cn(
            "border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
            verbose
              ? "border-[color:var(--color-teal)]/50 text-[color:var(--color-teal)]"
              : "border-[color:var(--color-line-bright)] text-[color:var(--color-faint)] hover:text-[color:var(--color-muted)]",
          )}
        >
          Verbose
        </button>
      }
      bodyClassName="scanlines"
    >
      {shown.length === 0 ? (
        <p className="px-3 py-6 text-center font-mono text-[11px] text-[color:var(--color-faint)]">
          Awaiting telemetry…
        </p>
      ) : (
        <ul className="font-mono text-[11px]">
          {shown.map((e) => (
            <LogRow key={e.id} event={e} state={state} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function LogRow({
  event,
  state,
}: {
  event: MissionEvent;
  state: MissionState | null;
}) {
  const tone = TONE[event.type] ?? "muted";
  return (
    <li className="flex gap-2 border-b border-[color:var(--color-line)]/50 px-3 py-1.5 leading-tight">
      <span className="shrink-0 text-[color:var(--color-faint)] tabular-nums">
        {formatClock(event.occurred_at)}
      </span>
      <span className={cn("shrink-0 font-semibold uppercase", TONE_CLASS[tone])}>
        {short(event.type)}
      </span>
      <span className="truncate text-[color:var(--color-muted)]">
        {describe(event, state)}
      </span>
    </li>
  );
}
