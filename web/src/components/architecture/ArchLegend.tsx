import type { ConnectionState } from "@/lib/types";

/**
 * Overlays the data-flow diagram: a status chip (top-left) that honestly states
 * whether the pipeline is live, simulated in-browser, or unreachable, plus a
 * compact colour key (bottom-left) for the packet/edge meanings.
 */

const MODE: Record<
  ConnectionState,
  { title: string; detail: string; token: string }
> = {
  open: { title: "LIVE PIPELINE", detail: "streaming events", token: "teal" },
  mock: {
    title: "SIMULATING PIPELINE",
    detail: "in-browser · no live Kafka",
    token: "amber",
  },
  connecting: { title: "LINKING…", detail: "establishing stream", token: "amber" },
  closed: { title: "LINK LOST", detail: "pipeline unreachable", token: "red" },
};

const KEY: { token: string; label: string }[] = [
  { token: "cyan", label: "command" },
  { token: "teal", label: "event" },
  { token: "green", label: "persist" },
  { token: "amber", label: "telemetry" },
  { token: "red", label: "error" },
];

export function ArchLegend({ connection }: { connection: ConnectionState }) {
  const mode = MODE[connection] ?? MODE.connecting;
  return (
    <>
      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full live-dot"
          style={{ backgroundColor: `var(--color-${mode.token})` }}
        />
        <div className="leading-tight">
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: `var(--color-${mode.token})` }}
          >
            {mode.title}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[color:var(--color-faint)]">
            {mode.detail}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1">
        {KEY.map((k) => (
          <span key={k.token} className="flex items-center gap-1">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: `var(--color-${k.token})` }}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
              {k.label}
            </span>
          </span>
        ))}
      </div>
    </>
  );
}
