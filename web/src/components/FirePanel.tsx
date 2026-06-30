"use client";

import { Flame } from "lucide-react";
import type { Fire } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/store/missionStore";
import { Panel } from "./Panel";

export function FirePanel() {
  const fires = useMissionStore((s) => s.state?.fires) ?? [];
  const active = fires.filter((f) => f.status !== "extinguished");

  return (
    <Panel
      title="Fires"
      icon={<Flame className="h-4 w-4" strokeWidth={2} />}
      count={`${active.length}/${fires.length}`}
    >
      {fires.length === 0 ? (
        <p className="px-3 py-6 text-center font-mono text-[11px] leading-relaxed text-[color:var(--color-faint)]">
          No active incidents.
          <br />
          Use <span className="text-[color:var(--color-fire)]">Place Fire</span> to start one.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--color-line)]">
          {fires.map((f) => (
            <FireRow key={f.id} fire={f} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function FireRow({ fire }: { fire: Fire }) {
  const selectedId = useMissionStore((s) => s.selectedFireId);
  const select = useMissionStore((s) => s.selectFire);
  const setTool = useMissionStore((s) => s.setTool);
  const responders = useMissionStore((s) => s.state?.responders) ?? [];

  const selected = selectedId === fire.id;
  const extinguished = fire.status === "extinguished";
  const crew = responders.filter(
    (r) => r.x === fire.x && r.y === fire.y && r.status === "fighting_fire",
  ).length;
  const frac = Math.max(0, Math.min(1, fire.intensity / 100));

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        className={cn(
          "block w-full cursor-pointer px-3 py-2.5 text-left transition-colors",
          selected ? "bg-[color:var(--color-fire)]/[0.08]" : "hover:bg-white/[0.02]",
          extinguished && "opacity-55",
        )}
        onClick={() => {
          select(selected ? null : fire.id);
          setTool("select");
        }}
      >
      <div className="flex items-center gap-2">
        <span className="font-display text-sm text-[color:var(--color-ink)]">
          Fire @ {fire.x},{fire.y}
        </span>
        <span
          className={cn(
            "ml-auto font-mono text-[10px] uppercase tracking-[0.14em]",
            extinguished
              ? "text-[color:var(--color-faint)]"
              : "text-[color:var(--color-fire)]",
          )}
        >
          {extinguished ? "Extinguished" : fire.status}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden bg-[color:var(--color-base)]">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${frac * 100}%`,
              background: extinguished
                ? "var(--color-faint)"
                : "linear-gradient(90deg, var(--color-fire-core), var(--color-fire))",
            }}
          />
        </div>
        <span className="w-8 text-right font-mono text-[11px] tabular-nums text-[color:var(--color-muted)]">
          {Math.round(fire.intensity)}
        </span>
      </div>

      {crew > 0 && !extinguished && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-[color:var(--color-amber)]">
          {crew} crew on scene · −{crew * 5}/tick
        </p>
      )}
      </button>
    </li>
  );
}
