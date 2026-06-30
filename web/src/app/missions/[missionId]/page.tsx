"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Radar } from "lucide-react";
import { DataFlowPanel } from "@/components/DataFlowPanel";
import { EventLog } from "@/components/EventLog";
import { FirePanel } from "@/components/FirePanel";
import { Hud } from "@/components/Hud";
import { Legend } from "@/components/Legend";
import { MissionGrid } from "@/components/MissionGrid";
import { NoticeToast } from "@/components/NoticeToast";
import { ResponderPanel } from "@/components/ResponderPanel";
import { Toolbar } from "@/components/Toolbar";
import { useMissionConnection } from "@/hooks/useMissionConnection";
import { config } from "@/lib/config";
import { cn, formatClock } from "@/lib/utils";
import { useMissionStore } from "@/store/missionStore";

export default function MissionPage() {
  const params = useParams<{ missionId: string }>();
  const missionId = params.missionId;
  useMissionConnection(missionId);

  const state = useMissionStore((s) => s.state);
  const replayCursor = useMissionStore((s) => s.replayCursor);
  const [flowOpen, setFlowOpen] = useState(true);
  const [flowExpanded, setFlowExpanded] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Hud />

      <main
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 gap-3 p-3",
          flowExpanded
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
            : "lg:grid-cols-[minmax(0,1fr)_350px]",
        )}
      >
        {/* left area — splits between the tactical grid (top) and data flow (bottom) */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* top — toolkit | tactical display */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[210px_minmax(0,1fr)]">
            <div className="flex flex-col gap-3 lg:overflow-y-auto">
              <Toolbar missionId={missionId} />
              <Legend />
            </div>

            <section className="panel flex min-h-0 flex-col">
              <header className="relative flex items-center gap-2 overflow-hidden border-b border-[color:var(--color-line)] px-3 py-2">
                <Radar className="h-4 w-4 text-[color:var(--color-teal)]" strokeWidth={2} />
                <span className="font-display text-sm tracking-wide">Tactical Display</span>
                {replayCursor ? (
                  <span className="label ml-auto text-[color:var(--color-amber)]">
                    Replay @ {formatClock(replayCursor.occurred_at)}
                  </span>
                ) : (
                  <span className="label ml-auto">
                    {config.mock ? "Local simulation" : "Live feed"}
                  </span>
                )}
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-[color:var(--color-teal)]/10 to-transparent"
                  style={{ animation: "sweep 6s linear infinite" }}
                />
              </header>
              <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4">
                {state ? (
                  <div
                    className="aspect-square w-full"
                    style={{
                      maxWidth: `min(100%, calc(100vh - ${!flowExpanded && flowOpen ? 332 : 168}px))`,
                    }}
                  >
                    <MissionGrid missionId={missionId} />
                  </div>
                ) : (
                  <LoadingField />
                )}
              </div>
            </section>
          </div>

          {/* bottom — system data flow band (spans toolkit + grid width) */}
          {!flowExpanded && (
            <div className={flowOpen ? "h-[252px] shrink-0" : "shrink-0"}>
              <DataFlowPanel
                collapsed={!flowOpen}
                expanded={false}
                onToggle={() => setFlowOpen((o) => !o)}
                onToggleExpand={() => {
                  setFlowOpen(true);
                  setFlowExpanded(true);
                }}
              />
            </div>
          )}
        </div>

        {/* right side — expanded data flow takes over, else the control rail */}
        {flowExpanded ? (
          <DataFlowPanel
            collapsed={false}
            expanded
            onToggle={() => setFlowOpen((o) => !o)}
            onToggleExpand={() => setFlowExpanded(false)}
          />
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            <ResponderPanel missionId={missionId} />
            <FirePanel />
            <div className="flex min-h-0 flex-[1.4] flex-col">
              <EventLog />
            </div>
          </div>
        )}
      </main>

      <NoticeToast />
    </div>
  );
}

function LoadingField() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Radar
        className="h-10 w-10 text-[color:var(--color-teal)] live-dot"
        strokeWidth={1.4}
      />
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
        Acquiring mission feed…
      </p>
    </div>
  );
}
