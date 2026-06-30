import type { MissionEvent, MissionEventType, MissionState } from "@/lib/types";

/** Event types hidden unless "verbose" is on (they fire every tick). */
export const NOISY: Set<MissionEventType> = new Set([
  "RESPONDER_MOVED",
  "FIRE_INTENSITY_CHANGED",
]);

export type Tone = "info" | "cyan" | "fire" | "warn" | "good" | "muted";

export const TONE: Record<MissionEventType, Tone> = {
  MISSION_CREATED: "info",
  FIRE_CREATED: "fire",
  MOUNTAIN_PLACED: "muted",
  MOUNTAIN_REMOVED: "muted",
  RESPONDER_CREATED: "cyan",
  RESPONDER_DISPATCHED: "cyan",
  RESPONDER_PATH_ASSIGNED: "cyan",
  RESPONDER_MOVED: "muted",
  SIGNAL_LOST: "warn",
  SIGNAL_RESTORED: "good",
  FIRE_INTENSITY_CHANGED: "fire",
  FIRE_EXTINGUISHED: "good",
  RESPONDER_RECONNECTED: "good",
  RESPONDER_POSITION_RECONCILED: "cyan",
  ROUTE_NOT_FOUND: "warn",
  MISSION_CONTROL_MOVED: "info",
  MISSION_RESET: "warn",
};

export const TONE_CLASS: Record<Tone, string> = {
  info: "text-[color:var(--color-ink)]",
  cyan: "text-[color:var(--color-cyan)]",
  fire: "text-[color:var(--color-fire)]",
  warn: "text-[color:var(--color-red)]",
  good: "text-[color:var(--color-teal)]",
  muted: "text-[color:var(--color-muted)]",
};

/** Abbreviated event-type label, e.g. RESPONDER_DISPATCHED → RSP_DISPATCHED. */
export function short(type: MissionEventType): string {
  return type.replace(/^RESPONDER_/, "RSP_").replace(/^MISSION_/, "MSN_");
}

/** Human-readable one-line description built from the event payload. */
export function describe(event: MissionEvent, state: MissionState | null): string {
  const p = event.payload as Record<string, any>;
  const responderName = (id?: string) =>
    state?.responders.find((r) => r.id === id)?.name ?? "responder";

  switch (event.type) {
    case "MISSION_CREATED":
      return String(p.name ?? "");
    case "FIRE_CREATED":
      return `@ ${p.fire?.x},${p.fire?.y}`;
    case "MOUNTAIN_PLACED":
    case "MOUNTAIN_REMOVED":
      return `@ ${p.x},${p.y}`;
    case "RESPONDER_CREATED":
      return `${p.responder?.name ?? ""} @ ${p.responder?.x},${p.responder?.y}`;
    case "RESPONDER_DISPATCHED":
      return `${responderName(p.responder_id)} → target`;
    case "RESPONDER_PATH_ASSIGNED":
      return `${responderName(p.responder_id)} · ${p.path?.length ?? 0} cells`;
    case "RESPONDER_MOVED":
      return `${responderName(p.responder_id)} → ${p.position?.x},${p.position?.y}`;
    case "SIGNAL_LOST":
      return `${responderName(p.responder_id)} behind terrain`;
    case "SIGNAL_RESTORED":
      return `${responderName(p.responder_id)} reacquired`;
    case "FIRE_INTENSITY_CHANGED":
      return `intensity ${Math.round(p.intensity ?? 0)}`;
    case "FIRE_EXTINGUISHED":
      return "incident closed";
    case "ROUTE_NOT_FOUND":
      return `${responderName(p.responder_id)} · no path`;
    case "MISSION_CONTROL_MOVED":
      return `→ ${p.x},${p.y}`;
    case "MISSION_RESET":
      return "grid cleared";
    default:
      return "";
  }
}
