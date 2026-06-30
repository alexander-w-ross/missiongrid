"use client";

import { useEffect, useState } from "react";
import {
  Eraser,
  Flame,
  type LucideIcon,
  MousePointer2,
  Mountain,
  Navigation,
  Crosshair,
  CirclePlus,
  RotateCcw,
} from "lucide-react";
import { useMissionActions } from "@/hooks/useMissionActions";
import type { Tool } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/store/missionStore";

interface ToolDef {
  tool: Tool;
  label: string;
  hint: string;
  icon: LucideIcon;
  key: string;
}

const TOOLS: ToolDef[] = [
  { tool: "select", label: "Inspect", hint: "Select a unit or fire to read its telemetry.", icon: MousePointer2, key: "1" },
  { tool: "fire", label: "Place Fire", hint: "Click an empty cell to ignite a fire (intensity 100).", icon: Flame, key: "2" },
  { tool: "mountain", label: "Raise Terrain", hint: "Click to place a mountain. Blocks movement and signal.", icon: Mountain, key: "3" },
  { tool: "remove_mountain", label: "Clear Terrain", hint: "Click a mountain to remove it.", icon: Eraser, key: "4" },
  { tool: "responder", label: "Deploy Unit", hint: "Click a cell to drop a new responder.", icon: CirclePlus, key: "5" },
  { tool: "dispatch", label: "Dispatch", hint: "Click a responder, then a fire, to route it.", icon: Navigation, key: "6" },
  { tool: "mission_control", label: "Move Control", hint: "Click anywhere — even off-grid — to relocate mission control.", icon: Crosshair, key: "7" },
];

export function Toolbar({ missionId }: { missionId: string }) {
  const tool = useMissionStore((s) => s.tool);
  const setTool = useMissionStore((s) => s.setTool);
  const selectedResponderId = useMissionStore((s) => s.selectedResponderId);
  const responders = useMissionStore((s) => s.state?.responders);
  const actions = useMissionActions(missionId);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target;
      // Don't hijack number keys while the user is typing in a control.
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLSelectElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      )
        return;
      const def = TOOLS.find((t2) => t2.key === e.key);
      if (def) setTool(def.tool);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTool]);

  const active = TOOLS.find((t) => t.tool === tool);
  const dispatchSource =
    tool === "dispatch" && selectedResponderId
      ? responders?.find((r) => r.id === selectedResponderId)?.name
      : null;

  return (
    <div className="panel flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="label">Toolkit</span>
        <span className="label text-[color:var(--color-faint)]">1–7</span>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const isActive = t.tool === tool;
          return (
            <button
              key={t.tool}
              onClick={() => setTool(t.tool)}
              className={cn(
                "group flex items-center gap-2.5 border px-2.5 py-2 text-left transition-all",
                isActive
                  ? "border-[color:var(--color-teal)]/60 bg-[color:var(--color-teal)]/10 text-[color:var(--color-teal)]"
                  : "border-transparent text-[color:var(--color-muted)] hover:border-[color:var(--color-line-bright)] hover:bg-white/[0.02] hover:text-[color:var(--color-ink)]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="font-mono text-xs tracking-wide">{t.label}</span>
              <kbd
                className={cn(
                  "ml-auto font-mono text-[10px]",
                  isActive ? "text-[color:var(--color-teal)]" : "text-[color:var(--color-faint)]",
                )}
              >
                {t.key}
              </kbd>
            </button>
          );
        })}
      </div>

      {active && (
        <p className="border-t border-[color:var(--color-line)] pt-2.5 font-mono text-[11px] leading-relaxed text-[color:var(--color-muted)]">
          {dispatchSource
            ? `${dispatchSource} selected — now click a fire to dispatch.`
            : active.hint}
        </p>
      )}

      <button
        onClick={() => {
          if (confirmReset) {
            actions.resetMission();
            setConfirmReset(false);
          } else {
            setConfirmReset(true);
            setTimeout(() => setConfirmReset(false), 3000);
          }
        }}
        className={cn(
          "flex items-center justify-center gap-2 border px-2.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
          confirmReset
            ? "border-[color:var(--color-red)] bg-[color:var(--color-red)]/15 text-[color:var(--color-red)]"
            : "border-[color:var(--color-line-bright)] text-[color:var(--color-muted)] hover:border-[color:var(--color-red)]/60 hover:text-[color:var(--color-red)]",
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
        {confirmReset ? "Confirm reset" : "Reset mission"}
      </button>
    </div>
  );
}
