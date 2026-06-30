"use client";

import { useState } from "react";
import { Users, Navigation } from "lucide-react";
import { useMissionActions } from "@/hooks/useMissionActions";
import type { Responder, ResponderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/store/missionStore";
import { Panel } from "./Panel";
import { SignalStatusBadge } from "./SignalStatusBadge";

const STATUS_STYLE: Record<ResponderStatus, string> = {
  idle: "text-[color:var(--color-muted)]",
  moving: "text-[color:var(--color-cyan)]",
  fighting_fire: "text-[color:var(--color-amber)]",
  returning: "text-[color:var(--color-cyan)]",
  disconnected: "text-[color:var(--color-red)]",
};

const STATUS_LABEL: Record<ResponderStatus, string> = {
  idle: "Idle",
  moving: "En route",
  fighting_fire: "Fighting fire",
  returning: "Returning",
  disconnected: "Disconnected",
};

export function ResponderPanel({ missionId }: { missionId: string }) {
  const responders = useMissionStore((s) => s.state?.responders) ?? [];

  return (
    <Panel
      title="Responders"
      icon={<Users className="h-4 w-4" strokeWidth={2} />}
      count={responders.length}
    >
      {responders.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y divide-[color:var(--color-line)]">
          {responders.map((r) => (
            <ResponderRow key={r.id} responder={r} missionId={missionId} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Empty() {
  return (
    <p className="px-3 py-6 text-center font-mono text-[11px] leading-relaxed text-[color:var(--color-faint)]">
      No responders deployed.
      <br />
      Use <span className="text-[color:var(--color-teal)]">Deploy Unit</span> to drop one on the grid.
    </p>
  );
}

function ResponderRow({
  responder,
  missionId,
}: {
  responder: Responder;
  missionId: string;
}) {
  const selectedId = useMissionStore((s) => s.selectedResponderId);
  const select = useMissionStore((s) => s.selectResponder);
  const setTool = useMissionStore((s) => s.setTool);
  const fires = useMissionStore((s) => s.state?.fires) ?? [];
  const actions = useMissionActions(missionId);
  const [fireId, setFireId] = useState<string>("");

  const selected = selectedId === responder.id;
  const activeFires = fires.filter((f) => f.status !== "extinguished");
  const blocked = responder.signal_status === "blocked";
  // Guard against a target that was extinguished while selected in the dropdown.
  const validFireId = activeFires.some((f) => f.id === fireId) ? fireId : "";

  return (
    <li
      className={cn(
        "transition-colors",
        selected ? "bg-[color:var(--color-teal)]/[0.07]" : "",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => {
          select(selected ? null : responder.id);
          setTool("select");
        }}
        className="block w-full cursor-pointer px-3 py-2.5 text-left hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <span className="font-display text-sm text-[color:var(--color-ink)]">
            {responder.name}
          </span>
          <span className={cn("font-mono text-[11px]", STATUS_STYLE[responder.status])}>
            {STATUS_LABEL[responder.status]}
          </span>
          <span className="ml-auto">
            <SignalStatusBadge status={responder.signal_status} />
          </span>
        </div>

        <div className="mt-1 flex gap-4 font-mono text-[11px] text-[color:var(--color-muted)]">
          <span>
            POS{" "}
            <span className="text-[color:var(--color-ink)]">
              {responder.x},{responder.y}
            </span>
          </span>
          {blocked && (
            <span className="text-[color:var(--color-red)]">
              LAST KNOWN {responder.last_known_x},{responder.last_known_y}
            </span>
          )}
        </div>
      </button>

      {selected && (
        <div className="mx-3 mb-2.5 flex items-center gap-2 border-t border-[color:var(--color-line)] pt-2.5">
          <select
            aria-label="Target fire"
            value={validFireId}
            onChange={(e) => setFireId(e.target.value)}
            className="min-w-0 flex-1 border border-[color:var(--color-line-bright)] bg-[color:var(--color-base)] px-2 py-1 font-mono text-[11px] text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-teal)]"
          >
            <option value="">Select target fire…</option>
            {activeFires.map((f) => (
              <option key={f.id} value={f.id}>
                Fire @ {f.x},{f.y} ({Math.round(f.intensity)})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!validFireId}
            onClick={() => {
              if (validFireId) actions.dispatchResponder(responder.id, validFireId);
            }}
            className="flex items-center gap-1.5 border border-[color:var(--color-teal)]/50 bg-[color:var(--color-teal)]/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-[color:var(--color-teal)] transition-colors hover:bg-[color:var(--color-teal)]/20 disabled:cursor-not-allowed disabled:border-[color:var(--color-line)] disabled:text-[color:var(--color-faint)] disabled:opacity-50"
          >
            <Navigation className="h-3 w-3" strokeWidth={2} />
            Go
          </button>
        </div>
      )}
    </li>
  );
}
