# MissionGrid

A real-time mission-coordination simulation. Operators run a tactical grid:
place fires and terrain, deploy responders and dispatch them with A\* pathfinding
around obstacles, and relocate mission control — while a live WebSocket feed
keeps every client in sync.

The twist is **line-of-sight comms**: mountains break the radio link between
mission control and a field unit. A responder that moves behind terrain goes
dark, buffers its movement locally, and reconciles the backlog once it
re-establishes line of sight.

## Why this exists

This project is an exploration into **using Kafka as the system of record** —
reading and writing domain events to/from a durable log instead of mutating
state in place. Every operator action is a *command* written to Kafka; the
simulation reads commands and writes *events*; downstream consumers read those
events to build a queryable read model and to push live updates to the UI.
State is a projection of the log, not the source of truth.

(The Kafka API is provided by [Redpanda](https://redpanda.com) — a single-node,
Zookeeper-free broker.)

## Event flow

```
Operator → FastAPI → mission.commands.v1 ──► Simulation Worker
                                                  │  stateful tick loop · A* · line-of-sight
                                                  ▼
                                         mission.events.v1
                                         ├──► Projector Worker → Postgres (read model)
                                         ├──► WS Broadcaster    → browser (live grid)
                                         └──◄ Telemetry Worker  ← responder.telemetry.v1
                                                                  (reconnect reconciliation)
```

- `mission.commands.v1` — operator intents (create mission, place fire, dispatch, …)
- `mission.events.v1` — official, ordered facts emitted by the simulation
- `responder.telemetry.v1` — buffered movement flushed when a dark unit reconnects
- `mission.dead_letter.v1` — commands that failed processing

## Stack

- **Backend** — FastAPI, async SQLAlchemy + asyncpg, Alembic, aiokafka
- **Broker** — Redpanda (Kafka API)
- **Store** — Postgres, holding the event-projected read model
- **Workers** — simulation (single replica, in-memory world), projector, telemetry
- **Frontend** — Next.js, Zustand, Tailwind; a live grid plus a "System Data
  Flow" panel that animates the pipeline and can replay the event log through it

## Running locally

Backend:

```bash
cd server
cp .env.example .env
docker compose up --build              # api + postgres + redpanda + console
docker compose --profile workers up    # simulation / projector / telemetry
```

Frontend:

```bash
cd web
cp .env.example .env.local             # NEXT_PUBLIC_MOCK=1 runs fully in-browser
npm install && npm run dev
```

## Deployment

- **Backend** — Coolify on a VPS via `server/docker-compose.prod.yml`: a one-shot
  `migrate` service runs Alembic, then the API and workers boot; only the API is
  exposed to the proxy.
- **Frontend** — Vercel (root directory `web`), pointed at the API over HTTPS/WSS.
