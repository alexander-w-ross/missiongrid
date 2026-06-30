# MissionGrid — Web Console

The frontend for **MissionGrid**, a real-time mission-control simulation. It is a
tactical operations console: place fires and terrain on a grid, dispatch
responders, watch them route around mountains with A\*, and watch the link to
mission control drop when terrain blocks line-of-sight.

Built with **Next.js (App Router) + TypeScript + Tailwind v4**. Type Chakra Petch
(display) + IBM Plex Mono/Sans. SVG tactical grid. Zustand store. Motion for
micro-interactions.

> This is the **UI layer only**. The backend (FastAPI + Kafka + Postgres) is
> specified in `../PRD.md` and is intentionally left to implement. The frontend
> talks to that backend's HTTP + WebSocket contract through a single swappable
> client (`src/lib/client.ts`).

---

## Quick start

```bash
cd web
npm install
cp .env.example .env.local   # already present; mock mode is on by default
npm run dev                  # http://localhost:3000
```

Open the app, click **Launch demo scenario**, and you'll get a seeded board
(a mountain ridge with a gap, two fires, three responders) running entirely in
your browser — no backend required.

### Useful scripts

| Command            | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Dev server with fast refresh             |
| `npm run build`    | Production build (also type-checks)       |
| `npm run start`    | Serve the production build               |
| `npm run typecheck`| `tsc --noEmit`                           |

---

## Mock mode vs. the real backend

The whole app is demoable today because of a small in-browser **mock backend**.
It is the *only* place the frontend runs simulation logic (A\*, line-of-sight,
fire ticks), and it lives entirely under `src/lib/mock/`. It emits the same
event envelopes the real Kafka pipeline will, so the store that consumes them is
identical for both.

Controlled by one env var:

```bash
# .env.local
NEXT_PUBLIC_MOCK=1   # in-browser simulation (default)
NEXT_PUBLIC_MOCK=0   # talk to the real FastAPI/WebSocket backend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

When you build the backend, flip `NEXT_PUBLIC_MOCK=0` and the same UI will drive
it — no component changes needed. The connection badge in the HUD shows
`MOCK` / `LIVE` / `LINKING` / `OFFLINE` so you always know which you're on.

> Mock state is in-memory, so a full page reload starts a fresh board. That's
> expected — durability is the backend's job.

---

## How it maps to the PRD

**Components** (PRD §19): `MissionGrid`, `Toolbar`, `ResponderPanel`,
`FirePanel`, `EventLog`, `SignalStatusBadge`, `MissionControlMarker` — all under
`src/components/` (plus `Hud`, `Panel`, `Legend`, `ConnectionBadge`,
`NoticeToast`).

**Pages** (PRD §19): `/` (landing/launcher) and `/missions/[missionId]` (console).

**API contract** (PRD §14–15): every endpoint and the WebSocket message format
are implemented in `src/lib/api.ts` and `src/lib/ws.ts`, behind the
`MissionClient` interface in `src/lib/client.ts`:

```
POST   /missions
GET    /missions/{id}
POST   /missions/{id}/fires
POST   /missions/{id}/mountains
DELETE /missions/{id}/mountains/{x}/{y}
POST   /missions/{id}/responders
POST   /missions/{id}/responders/{rid}/dispatch
POST   /missions/{id}/mission-control/move
POST   /missions/{id}/reset
WS     /ws/missions/{id}
```

The UI honours the PRD's separation of concerns: it **renders state and applies
events**, and never computes pathfinding, signal loss, or fire updates itself
(outside the mock). Commands are fire-and-forget; the resulting state arrives via
the event stream, exactly as it will with Kafka + the projector.

---

## Project layout

```
web/src
  app/
    page.tsx                     landing / mission launcher
    missions/[missionId]/page.tsx  the console
    layout.tsx, globals.css      fonts + tactical theme
  components/                    UI (see PRD §19 mapping above)
  hooks/
    useMissionConnection.ts      load snapshot + subscribe to events
    useMissionActions.ts         bound command surface
  store/missionStore.ts          zustand store + event reducer
  lib/
    types.ts                     contract types (PRD §8, §12, §14, §15)
    config.ts                    env + grid constants
    api.ts                       HTTP client (real backend)
    ws.ts                        WebSocket client w/ reconnect
    client.ts                    real ↔ mock swap
    grid.ts                      SVG geometry helpers
    mock/                        in-browser backend (dev only)
      mockBackend.ts             tick loop + commands + event emission
      pathfinding.ts             A* (mirrors backend service)
      lineOfSight.ts             Bresenham LOS (mirrors backend service)
```

---

## Controls

Toolbar tools map to number keys **1–7**: Inspect, Place Fire, Raise Terrain,
Clear Terrain, Deploy Unit, Dispatch, Move Control.

- **Dispatch**: select Dispatch, click a responder, then click a fire — or use
  the dropdown in the Responders panel.
- **Move Control**: click anywhere, including off-grid, to relocate mission
  control. Signal line-of-sight recomputes for every unit.

---

## Deployment

Vercel-ready (PRD §5). Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, and
`NEXT_PUBLIC_MOCK=0` in the Vercel project env once the backend is live.
