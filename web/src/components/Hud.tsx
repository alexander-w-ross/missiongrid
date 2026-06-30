"use client";

import Link from "next/link";
import { Github, Hexagon } from "lucide-react";
import { useMissionStore } from "@/store/missionStore";
import { ConnectionBadge } from "./ConnectionBadge";

export function Hud() {
  const state = useMissionStore((s) => s.state);
  const responders = state?.responders ?? [];
  const blocked = responders.filter((r) => r.signal_status === "blocked").length;
  const activeFires = state?.fires.filter((f) => f.status !== "extinguished").length ?? 0;

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[color:var(--color-line)] bg-[color:var(--color-base)]/70 px-4 py-2.5 backdrop-blur">
      <Link href="/" className="flex items-center gap-2.5">
        <Hexagon
          className="h-5 w-5 text-[color:var(--color-teal)] text-glow"
          strokeWidth={1.6}
          fill="rgba(46,230,198,0.12)"
        />
        <div className="leading-none">
          <div className="font-display text-base tracking-[0.08em] text-[color:var(--color-ink)]">
            MISSION<span className="text-[color:var(--color-teal)]">GRID</span>
          </div>
          <div className="label mt-0.5">Operations Console</div>
        </div>
      </Link>

      <div className="hidden h-8 w-px bg-[color:var(--color-line)] sm:block" />

      <div className="min-w-0">
        <div className="truncate font-mono text-sm text-[color:var(--color-ink)]">
          {state?.name ?? "—"}
        </div>
        <div className="truncate font-mono text-[10px] text-[color:var(--color-faint)]">
          {state?.mission_id ?? ""}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <Stat label="Grid" value={state ? `${state.width}×${state.height}` : "—"} />
        <Stat label="Units" value={String(responders.length)} />
        <Stat
          label="No Signal"
          value={String(blocked)}
          tone={blocked > 0 ? "warn" : undefined}
        />
        <Stat
          label="Fires"
          value={String(activeFires)}
          tone={activeFires > 0 ? "fire" : undefined}
        />
        <a
          href="https://github.com/alexander-w-ross/missiongrid"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="View source on GitHub"
          title="View source on GitHub"
          className="text-[color:var(--color-muted)] transition-colors hover:text-[color:var(--color-ink)]"
        >
          <Github className="h-5 w-5" strokeWidth={1.8} />
        </a>
        <ConnectionBadge />
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "fire";
}) {
  const color =
    tone === "warn"
      ? "text-[color:var(--color-red)]"
      : tone === "fire"
        ? "text-[color:var(--color-fire)]"
        : "text-[color:var(--color-ink)]";
  return (
    <div className="hidden text-right md:block">
      <div className={`stat-value text-lg leading-none ${color}`}>{value}</div>
      <div className="label mt-0.5">{label}</div>
    </div>
  );
}
