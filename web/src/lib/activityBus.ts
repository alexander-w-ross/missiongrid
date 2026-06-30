/**
 * A tiny module-level pub/sub for outbound-command pings.
 *
 * Inbound events already flow through the Zustand store, but commands the user
 * fires never do (they go straight to HTTP and only their *effects* return as
 * events). This bus lets `useMissionActions` announce a command the instant it's
 * sent, so the architecture view can animate the command half of the pipeline
 * immediately on click — without routing UI-only animation signals through the
 * mission store (which the rest of the console subscribes to).
 */
export type CommandPing = { type: string };
type Listener = (ping: CommandPing) => void;

const listeners = new Set<Listener>();

export const activityBus = {
  emitCommand(type: string) {
    const ping = { type };
    for (const l of listeners) l(ping);
  },
  onCommand(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
