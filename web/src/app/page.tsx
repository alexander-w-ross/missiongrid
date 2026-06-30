"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowRight,
  Hexagon,
  Loader2,
  Network,
  Radio,
  Route,
  Waypoints,
} from "lucide-react";
import { client } from "@/lib/client";
import { config } from "@/lib/config";

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState("Demo Mission");
  const [busy, setBusy] = useState<"blank" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function launch(seedDemo: boolean) {
    setError(null);
    setBusy(seedDemo ? "demo" : "blank");
    try {
      const { mission_id } = await client.createMission({
        name: name.trim() || "Untitled Mission",
        width: 20,
        height: 20,
      });
      if (seedDemo && config.mock) await seedScenario(mission_id);
      router.push(`/missions/${mission_id}`);
    } catch (err) {
      setBusy(null);
      setError(
        err instanceof Error
          ? `Could not create mission: ${err.message}`
          : "Could not create mission. Is the backend running?",
      );
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* radar flourish */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full border border-[color:var(--color-line)] opacity-40" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full border border-[color:var(--color-line)] opacity-30" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl"
      >
        <div className="mb-3 flex items-center gap-3">
          <Hexagon
            className="h-7 w-7 text-[color:var(--color-teal)] text-glow"
            strokeWidth={1.5}
            fill="rgba(46,230,198,0.12)"
          />
          <span className="label text-[color:var(--color-teal)]">
            Real-time mission-control simulation
          </span>
        </div>

        <h1 className="font-display text-6xl font-semibold leading-[0.95] tracking-[0.02em] text-[color:var(--color-ink)] sm:text-7xl md:text-8xl">
          MISSION
          <span className="text-[color:var(--color-teal)] text-glow">GRID</span>
        </h1>

        <p className="mt-6 max-w-xl font-mono text-sm leading-relaxed text-[color:var(--color-muted)]">
          Place fires and terrain, dispatch responders, and watch units route
          around mountains with A* — then drag mission control behind the ridge
          and watch the link drop. State is event-driven: commands in, official
          events out, projected to a live grid.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          {/* feature chips */}
          <div className="grid grid-cols-2 gap-3">
            <Feature
              icon={<Network className="h-4 w-4" />}
              title="Event-driven core"
              body="Commands & events flow through a durable log; Postgres holds current state."
            />
            <Feature
              icon={<Route className="h-4 w-4" />}
              title="A* pathfinding"
              body="Responders route cell-by-cell around terrain, or report no route."
            />
            <Feature
              icon={<Radio className="h-4 w-4" />}
              title="Line-of-sight signal"
              body="Mountains break the link between mission control and field units."
            />
            <Feature
              icon={<Waypoints className="h-4 w-4" />}
              title="Live telemetry"
              body="WebSocket stream keeps the console in sync without refreshes."
            />
          </div>

          {/* launcher */}
          <div className="panel flex flex-col gap-4 p-5">
            <div className="label">Launch a mission</div>
            <label className="block">
              <span className="label">Mission name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full border border-[color:var(--color-line-bright)] bg-[color:var(--color-base)] px-3 py-2 font-mono text-sm text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-teal)]"
                placeholder="Demo Mission"
              />
            </label>

            <button
              onClick={() => launch(true)}
              disabled={busy !== null}
              className="group flex items-center justify-center gap-2 border border-[color:var(--color-teal)]/60 bg-[color:var(--color-teal)]/12 px-4 py-2.5 font-mono text-sm uppercase tracking-[0.12em] text-[color:var(--color-teal)] transition-colors hover:bg-[color:var(--color-teal)]/20 disabled:opacity-60"
            >
              {busy === "demo" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
              Launch demo scenario
            </button>

            <button
              onClick={() => launch(false)}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 border border-[color:var(--color-line-bright)] px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)] transition-colors hover:border-[color:var(--color-ink)]/30 hover:text-[color:var(--color-ink)] disabled:opacity-60"
            >
              {busy === "blank" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              New blank grid
            </button>

            {error && (
              <p
                role="alert"
                className="border border-[color:var(--color-red)]/50 bg-[color:var(--color-red)]/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-[color:var(--color-red)]"
              >
                {error}
              </p>
            )}

            <p className="border-t border-[color:var(--color-line)] pt-3 font-mono text-[10px] leading-relaxed text-[color:var(--color-faint)]">
              {config.mock ? (
                <>
                  <span className="text-[color:var(--color-amber)]">MOCK MODE</span>{" "}
                  — simulating locally in your browser. Set{" "}
                  <code>NEXT_PUBLIC_MOCK=0</code> to use the FastAPI backend.
                </>
              ) : (
                <>
                  Connected to <code>{config.apiUrl}</code>. Ensure the backend
                  is running.
                </>
              )}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-[color:var(--color-teal)]">
        {icon}
        <span className="font-display text-sm tracking-wide text-[color:var(--color-ink)]">
          {title}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[color:var(--color-muted)]">
        {body}
      </p>
    </div>
  );
}

/** Seed a demonstrative board (mock mode only). */
async function seedScenario(missionId: string) {
  // A ridge down the middle with a single passage.
  for (let y = 2; y <= 17; y++) {
    if (y === 9 || y === 10) continue; // gap
    await client.placeMountain(missionId, { x: 9, y });
  }
  // Fires behind the ridge.
  await client.placeFire(missionId, { x: 15, y: 5, intensity: 100 });
  await client.placeFire(missionId, { x: 16, y: 14, intensity: 100 });
  // Responders staged on the near side.
  await client.createResponder(missionId, { name: "R-1", x: 2, y: 6 });
  await client.createResponder(missionId, { name: "R-2", x: 2, y: 13 });
  await client.createResponder(missionId, { name: "R-3", x: 3, y: 10 });
}
