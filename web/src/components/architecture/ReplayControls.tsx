"use client";

import { Pause, Play, SkipBack } from "lucide-react";
import {
  REPLAY_SPEEDS,
  type ReplayController,
} from "@/hooks/useArchitectureSignals";
import { describe, short } from "@/lib/eventFormat";
import { cn, formatClock } from "@/lib/utils";
import { useMissionStore } from "@/store/missionStore";

/**
 * Transport bar for replaying the event log back through the flow diagram:
 * restart / play-pause, slower-cadence speed steps, a seekable progress track,
 * and a "now playing" caption for the event currently animating.
 */
export function ReplayControls({ replay }: { replay: ReplayController }) {
  const events = useMissionStore((s) => s.events);
  const state = useMissionStore((s) => s.state);
  const empty = events.length === 0;
  const playing = replay.status === "playing";
  const total = replay.total || events.length;
  const frac = total > 0 ? replay.index / total : 0;

  const btn =
    "flex items-center gap-1 border border-[color:var(--color-line-bright)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-faint)] transition-colors hover:text-[color:var(--color-muted)] disabled:opacity-40 disabled:hover:text-[color:var(--color-faint)]";

  return (
    <div className="flex flex-col gap-1.5 border-t border-[color:var(--color-line)] px-2 py-2">
      <div className="flex h-4 items-center gap-2 font-mono text-[10px] leading-none">
        <span className="shrink-0 uppercase tracking-[0.18em] text-[color:var(--color-faint)]">
          {replay.current ? "Now ▸" : "Replay"}
        </span>
        {replay.current ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 tabular-nums text-[color:var(--color-faint)]">
              {formatClock(replay.current.occurred_at)}
            </span>
            <span className="shrink-0 font-semibold uppercase text-[color:var(--color-cyan)]">
              {short(replay.current.type)}
            </span>
            <span className="truncate text-[color:var(--color-muted)]">
              {describe(replay.current, state)}
            </span>
          </span>
        ) : (
          <span className="text-[color:var(--color-faint)]">
            {empty ? "no events yet" : "step the event log through the pipeline"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={replay.restart}
          disabled={empty}
          aria-label="Restart replay"
          className={btn}
        >
          <SkipBack className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={playing ? replay.pause : replay.play}
          disabled={empty}
          aria-label={playing ? "Pause replay" : "Play replay"}
          className={btn}
        >
          {playing ? (
            <>
              <Pause className="h-3 w-3" /> Pause
            </>
          ) : (
            <>
              <Play className="h-3 w-3" /> Play
            </>
          )}
        </button>

        <div className="ml-1 flex items-center gap-1">
          {REPLAY_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => replay.setSpeed(s)}
              aria-pressed={replay.speed === s}
              className={cn(
                "border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
                replay.speed === s
                  ? "border-[color:var(--color-cyan)]/50 text-[color:var(--color-cyan)]"
                  : "border-[color:var(--color-line-bright)] text-[color:var(--color-faint)] hover:text-[color:var(--color-muted)]",
              )}
            >
              {s}×
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="Seek replay"
          disabled={empty}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - r.left) / r.width;
            replay.seek(pct * total);
          }}
          className="group relative ml-1 h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--color-line-bright)] disabled:opacity-40"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--color-cyan)]/70 transition-[width]"
            style={{ width: `${Math.min(100, frac * 100)}%` }}
          />
        </button>

        <span className="shrink-0 font-mono text-[10px] tabular-nums text-[color:var(--color-faint)]">
          {replay.index} / {total}
        </span>

        {replay.current && (
          <button
            type="button"
            onClick={replay.goLive}
            aria-label="Return to live"
            className={cn(
              btn,
              "shrink-0 border-[color:var(--color-teal)]/50 text-[color:var(--color-teal)] hover:text-[color:var(--color-teal)]",
            )}
          >
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-teal)]" />
            Live
          </button>
        )}
      </div>
    </div>
  );
}
