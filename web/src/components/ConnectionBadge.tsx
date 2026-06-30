"use client";

import type { ConnectionState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/store/missionStore";

const MAP: Record<
  ConnectionState,
  { label: string; dot: string; text: string; border: string }
> = {
  open: {
    label: "Live",
    dot: "bg-[color:var(--color-teal)]",
    text: "text-[color:var(--color-teal)]",
    border: "border-[color:var(--color-teal)]/40",
  },
  mock: {
    label: "Mock",
    dot: "bg-[color:var(--color-amber)]",
    text: "text-[color:var(--color-amber)]",
    border: "border-[color:var(--color-amber)]/40",
  },
  connecting: {
    label: "Linking",
    dot: "bg-[color:var(--color-amber)]",
    text: "text-[color:var(--color-amber)]",
    border: "border-[color:var(--color-amber)]/40",
  },
  closed: {
    label: "Offline",
    dot: "bg-[color:var(--color-red)]",
    text: "text-[color:var(--color-red)]",
    border: "border-[color:var(--color-red)]/40",
  },
};

export function ConnectionBadge() {
  const connection = useMissionStore((s) => s.connection);
  const { label, dot, text, border } = MAP[connection];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em]",
        border,
        text,
      )}
      title={
        connection === "mock"
          ? "Running against the in-browser mock backend (NEXT_PUBLIC_MOCK=1)"
          : `WebSocket: ${connection}`
      }
    >
      <span className={cn("h-2 w-2 rounded-full live-dot", dot)} />
      {label}
    </span>
  );
}
