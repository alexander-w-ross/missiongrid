import { Radio, RadioTower, WifiOff } from "lucide-react";
import type { SignalStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP: Record<
  SignalStatus,
  { label: string; color: string; bg: string; Icon: typeof Radio }
> = {
  connected: {
    label: "Connected",
    color: "text-[color:var(--color-teal)]",
    bg: "border-[color:var(--color-teal)]/40 bg-[color:var(--color-teal)]/10",
    Icon: RadioTower,
  },
  blocked: {
    label: "Signal Lost",
    color: "text-[color:var(--color-red)]",
    bg: "border-[color:var(--color-red)]/40 bg-[color:var(--color-red)]/10",
    Icon: WifiOff,
  },
  reconnecting: {
    label: "Reconnecting",
    color: "text-[color:var(--color-amber)]",
    bg: "border-[color:var(--color-amber)]/40 bg-[color:var(--color-amber)]/10",
    Icon: Radio,
  },
};

export function SignalStatusBadge({
  status,
  className,
}: {
  status: SignalStatus;
  className?: string;
}) {
  const { label, color, bg, Icon } = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
        bg,
        color,
        className,
      )}
    >
      <Icon
        className={cn("h-3 w-3", status === "blocked" && "live-dot")}
        strokeWidth={2.2}
      />
      {label}
    </span>
  );
}
