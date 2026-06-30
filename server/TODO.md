# MissionGrid Backend — Implementation TODO

An **ordered, top-to-bottom** build checklist derived from `../PRD.md`. The PRD is
organized by topic (models in §13, files in §18, the frontend contract in §26);
this file re-sequences it so you're never blocked on something unwritten.

**How to use this:** work the phases in order. Each model gets a field table
(field · `Mapped` type · SQL type · null/default · notes). The **SQLAlchemy 2.0
refresher** below is the syntax cheatsheet — every model step points back to it.
Each phase ends with a **migration? / rebuild? / restart?** line telling you
exactly what to run.

> You write the core domain code by hand (models, services, workers, routes).
> This doc gives refreshers and types, not paste-ready solutions.

---

## Command reference (defined once, referenced by number below)

`DATABASE_URL` defaults to the **in-container** `postgres` hostname, so the
cleanest place to run Alembic is inside the `api` container.

```bash
# [C1] bring up infra
docker compose up -d postgres redpanda redpanda-console

# [C2] create a migration after adding/editing models
docker compose exec api alembic revision --autogenerate -m "describe change"

# [C3] apply migrations
docker compose exec api alembic upgrade head

# [C4] roll back one migration
docker compose exec api alembic downgrade -1

# [C5] inspect current schema (list tables)
docker compose exec postgres psql -U missiongrid -d missiongrid -c "\dt"

# [C6] rebuild image after editing requirements.txt (NOT needed for app code — it's volume-mounted)
docker compose build api && docker compose up -d api

# [C7] start the API
docker compose up -d api          # http://localhost:8000  (docs at /docs)

# [C8] run the workers (gated behind the "workers" compose profile)
docker compose --profile workers up -d

# [C9] tail logs
docker compose logs -f api simulation-worker projector-worker
```

> **Host-shell alternative.** To run `alembic` / `pytest` / `uvicorn` from your
> `.venv` instead of the container, point `DATABASE_URL` at `localhost:5432` and
> Kafka at `localhost:19092` (see `.env.example`), then run e.g.
> `alembic upgrade head` directly. The container path `[C2]/[C3]` is recommended
> so you don't juggle two URLs.

### When do I migrate vs. rebuild vs. restart?

| You changed… | Do this |
| --- | --- |
| A model field / a table (added/removed/renamed/retyped) | `[C2]` then `[C3]` |
| A service / route / worker `.py` file | **Nothing.** Code is volume-mounted; API runs `uvicorn --reload`, workers run under `watchfiles` |
| `requirements.txt` | `[C6]` (rebuild image) |
| `.env` | restart the affected container (`docker compose up -d --force-recreate api`) |
| `docker-compose.yml` | `docker compose up -d` (re-reads compose) |

> Migrations are **not** auto-applied on startup. After every model change you
> must run `[C2]` + `[C3]` yourself.

---

## SQLAlchemy 2.0 syntax refresher

Match the style already in `app/models/mission.py`: `Mapped[...]` annotations +
`mapped_column(...)`. Python type → nullability; `mapped_column` → DB details.

```python
from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base   # NOTE: "app.", not "server.app." — see Step 0


class Example(Base):
    __tablename__ = "examples"

    # --- UUID primary key (the existing pattern; Postgres generates it) ---
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    # --- required vs nullable ---
    # Mapped[X]        -> NOT NULL
    # Mapped[X | None] -> NULL allowed
    name: Mapped[str] = mapped_column()                 # TEXT/VARCHAR, NOT NULL
    note: Mapped[str | None] = mapped_column()           # nullable

    # --- numbers / bools ---
    width: Mapped[int] = mapped_column()                 # INTEGER
    active: Mapped[bool] = mapped_column()               # BOOLEAN

    # --- default (Python-side) vs server_default (DB-side) ---
    path_index: Mapped[int] = mapped_column(default=0)            # app sets it
    intensity: Mapped[int] = mapped_column(server_default="100")  # DB sets it; string!

    # --- foreign key ---
    mission_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("missions.id"), nullable=False
    )
    # nullable FK:
    assigned_fire_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("fires.id")
    )

    # --- JSONB ---
    payload: Mapped[dict | None] = mapped_column(JSONB)
    path_json: Mapped[list | None] = mapped_column(JSONB)

    # --- timestamps ---
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # --- table-level constraints / indexes ---
    __table_args__ = (
        UniqueConstraint("mission_id", "x", "y", name="uq_example_cell"),
        Index("ix_example_mission_id", "mission_id"),
    )

    # --- relationship (optional but handy on Mission) ---
    # cells: Mapped[list["MissionCell"]] = relationship(back_populates="mission")
```

**Python → SQL type cheatsheet**

| `Mapped[...]` | SQL (Postgres) |
| --- | --- |
| `int` | INTEGER |
| `str` | VARCHAR / TEXT |
| `bool` | BOOLEAN |
| `datetime` | TIMESTAMP |
| `UUID` (with `PG_UUID(as_uuid=True)`) | UUID |
| `dict` / `list` (with `JSONB`) | JSONB |

> **`server_default` values are strings** (`"0"`, `"100"`) or SQL functions
> (`func.now()`), never raw Python ints. `default=` is plain Python.

---

## Step 0 — Fix the scaffold bug (do this first)

`app/models/mission.py:3` currently imports:

```python
from server.app.db.base import Base   # ✗ wrong — breaks Alembic autogenerate
```

Change it to match the rest of the project (Docker workdir is `/app`, so the
module root is `app`):

```python
from app.db.base import Base          # ✓
```

Until this is fixed, importing `app.models` (which `alembic/env.py` does) fails
and `[C2]` won't see your tables.

**Run:** nothing yet.

---

## Phase 1 — Data layer + first migration

PRD §13, §18.5–18.10. Build all 9 models, re-export each from
`app/models/__init__.py` (Alembic only sees re-exported models), then migrate
**once** at the end of the phase.

> After writing each model, add its import to `app/models/__init__.py`, e.g.
> `from app.models.fire import Fire`.

### 1.1 `missions` — finish the stub `app/models/mission.py`

| field | `Mapped` type | SQL | null/default | notes |
| --- | --- | --- | --- | --- |
| `id` | `UUID` | UUID | PK, `server_default=gen_random_uuid()` | already present |
| `name` | `str` | TEXT | NOT NULL | |
| `width` | `int` | INTEGER | NOT NULL | MVP 20 |
| `height` | `int` | INTEGER | NOT NULL | MVP 20 |
| `status` | `str` | TEXT | NOT NULL | `active` etc. (string enum for MVP) |
| `created_at` | `datetime` | TIMESTAMP | `server_default=now()` | |
| `updated_at` | `datetime` | TIMESTAMP | `server_default=now()`, `onupdate=now()` | |

Optional: `relationship()` back-refs to cells/fires/responders (refresher).

### 1.2 `mission_cells` — `app/models/cell.py`

| field | type | SQL | null/default | notes |
| --- | --- | --- | --- | --- |
| `id` | `UUID` | UUID | PK gen | |
| `mission_id` | `UUID` | UUID | FK→missions.id, NOT NULL | |
| `x` | `int` | INTEGER | NOT NULL | |
| `y` | `int` | INTEGER | NOT NULL | |
| `terrain` | `str` | TEXT | NOT NULL | `empty` \| `mountain` |
| `created_at` / `updated_at` | `datetime` | TIMESTAMP | now() | |

`__table_args__`: `UniqueConstraint("mission_id", "x", "y")`.

### 1.3 `fires` — `app/models/fire.py`

| field | type | SQL | null/default | notes |
| --- | --- | --- | --- | --- |
| `id` | `UUID` | UUID | PK gen | |
| `mission_id` | `UUID` | UUID | FK, NOT NULL | |
| `x` / `y` | `int` | INTEGER | NOT NULL | |
| `intensity` | `int` | INTEGER | NOT NULL, default 100 | clamp ≥0 in service layer |
| `status` | `str` | TEXT | NOT NULL | `active` \| `contained` \| `extinguished` |
| `created_at` / `updated_at` | `datetime` | TIMESTAMP | now() | |
| `extinguished_at` | `datetime \| None` | TIMESTAMP | nullable | |

`__table_args__`: `Index(... "mission_id")`.

### 1.4 `responders` — `app/models/responder.py`

| field | type | SQL | null/default | notes |
| --- | --- | --- | --- | --- |
| `id` | `UUID` | UUID | PK gen | |
| `mission_id` | `UUID` | UUID | FK, NOT NULL | |
| `name` | `str` | TEXT | NOT NULL | |
| `x` / `y` | `int` | INTEGER | NOT NULL | live position |
| `last_known_x` / `last_known_y` | `int` | INTEGER | NOT NULL | what MC last saw |
| `status` | `str` | TEXT | NOT NULL | `idle\|moving\|fighting_fire\|returning\|disconnected` |
| `signal_status` | `str` | TEXT | NOT NULL | `connected\|blocked\|reconnecting` |
| `assigned_fire_id` | `UUID \| None` | UUID | FK→fires.id, nullable | |
| `path_json` | `list \| None` | JSONB | nullable | `[{x,y}, ...]` |
| `path_index` | `int` | INTEGER | default 0 | |
| `created_at` / `updated_at` | `datetime` | TIMESTAMP | now() | |

### 1.5 `mission_control` — `app/models/mission_control.py`

| field | type | SQL | null/default | notes |
| --- | --- | --- | --- | --- |
| `id` | `UUID` | UUID | PK gen | |
| `mission_id` | `UUID` | UUID | FK, NOT NULL | one per mission |
| `x` / `y` | `int` | INTEGER | NOT NULL | **may be negative / off-grid** (e.g. x=-2) |
| `created_at` / `updated_at` | `datetime` | TIMESTAMP | now() | |

### 1.6 `mission_events` — `app/models/event.py`

| field | type | SQL | null/default | notes |
| --- | --- | --- | --- | --- |
| `id` | `UUID` | UUID | PK gen | |
| `mission_id` | `UUID` | UUID | NOT NULL | (index it) |
| `type` | `str` | TEXT | NOT NULL | event type string |
| `payload` | `dict` | JSONB | NOT NULL | |
| `correlation_id` | `UUID \| None` | UUID | nullable | |
| `causation_id` | `UUID \| None` | UUID | nullable | |
| `occurred_at` | `datetime` | TIMESTAMP | NOT NULL | sort key for newest-first reads |
| `created_at` | `datetime` | TIMESTAMP | now() | |

### 1.7 `processed_messages` — same file `app/models/event.py`

Idempotency ledger (PRD §13.7).

| field | type | SQL | null/default | notes |
| --- | --- | --- | --- | --- |
| `id` | `UUID` | UUID | PK gen | |
| `message_id` | `str` | TEXT | **UNIQUE**, NOT NULL | the envelope `id` |
| `consumer_name` | `str` | TEXT | NOT NULL | e.g. `state-projectors` |
| `processed_at` | `datetime` | TIMESTAMP | now() | |

`__table_args__`: `UniqueConstraint("message_id")` (or unique on
`(message_id, consumer_name)` if you want per-consumer dedup).

### 1.8 `responder_local_outbox` + `pending_responder_commands` — `app/models/outbox.py`

Advanced/Phase 8 tables — **create them now, use them later** (PRD §13.8–13.9).

`ResponderLocalOutbox`: `id` UUID PK · `mission_id` UUID · `responder_id` UUID ·
`event_type` str/TEXT · `payload` dict/JSONB · `occurred_at` datetime/TIMESTAMP ·
`flushed_at` `datetime | None`/TIMESTAMP nullable.

`PendingResponderCommand`: `id` UUID PK · `mission_id` UUID · `responder_id` UUID ·
`command_type` str/TEXT · `payload` dict/JSONB · `delivered_at`
`datetime | None`/TIMESTAMP nullable · `created_at` datetime/TIMESTAMP now().

### Phase 1 checkpoint

- Re-exported all models from `app/models/__init__.py`.
- **Run:** `[C1]`, then `[C2]` with `-m "initial mission schema"`, then `[C3]`.
- Verify with `[C5]` — you should see all 9 tables plus `alembic_version`.

**→ migration: YES (`[C2]`+`[C3]`). rebuild: no. restart: no.**

---

## Phase 2 — Pydantic schemas

PRD §18.11–18.15. **§26 is the authoritative contract** — field names are
snake_case and the frontend reducer reads them exactly.

- `app/schemas/common.py` — `Point {x:int, y:int}`, `GridSize`, shared enum
  literals (terrain/status/signal).
- `app/schemas/mission.py` — response models the UI renders from (§26.1):
  `MissionStateResponse`, `FireResponse`, `ResponderResponse`, `CellResponse`,
  `RecentEventResponse`. Match §26.1 field names exactly —
  `responders[].last_known_x/last_known_y`, `path`, `path_index`,
  `signal_status`, `assigned_fire_id`, etc.
- `app/schemas/commands.py` — `CommandEnvelope` (PRD §12/§18.12) + payload classes
  (`CreateMissionPayload`, `PlaceFirePayload`, …, `ResetMissionPayload`).
- `app/schemas/events.py` — event envelope + payload classes.
- `app/schemas/websocket.py` — `mission_event`, `snapshot`, `error` message
  wrappers (and optional inbound `command`).

> **Watch the nested shapes (§26.2)** — the UI expects objects, not flat x/y:
> - `FIRE_CREATED` → `{ fire: FireResponse }`
> - `RESPONDER_CREATED` → `{ responder: ResponderResponse }`
> - `RESPONDER_MOVED` → `{ responder_id, position:{x,y}, last_known:{x,y}, path_index, status, signal_status }`
> - `SIGNAL_LOST` → `{ responder_id, last_known:{x,y}, blocked_by:{x,y} }`
> - `SIGNAL_RESTORED` → `{ responder_id, position:{x,y} }`
> - `MISSION_RESET` → `{ mission_control:{x,y} }`

**→ migration: no (Pydantic only). rebuild: no. restart: no.**

---

## Phase 3 — Kafka plumbing

PRD §18.16–18.18.

- `app/kafka/topics.py` — the four topic-name constants.
- `app/kafka/serialization.py` — `serialize_message()` / `deserialize_message()`,
  JSON with working datetime handling, validate required envelope fields.
- `app/kafka/client.py` — aiokafka producer wrapper: `start_producer()`,
  `stop_producer()`, `publish(topic, key, value)`, plus `publish_command` /
  `publish_event` / `publish_dead_letter`. **Key every message by `mission_id`**
  (PRD §11) so a mission's events stay ordered.

**→ migration: no. rebuild: no. restart: no.**

---

## Phase 4 — Command intake API (vertical slice you can curl)

PRD §14, §18.2, §18.19, §18.20, §18.29.

- `app/services/command_service.py` — build a `CommandEnvelope`, publish to
  `mission.commands.v1`, return the command id. **Does not mutate state.**
- `app/services/mission_service.py` — `get_mission_state(mission_id)` queries
  mission + cells + fires + responders + mission_control + recent events, returns
  `MissionStateResponse`. **`recent_events` must be newest-first**
  (`ORDER BY occurred_at DESC LIMIT N`, §14.3).
- `app/api/http.py` — all routes from §14: health, create mission, get state,
  place fire, place/remove mountain, create responder, dispatch, move mission
  control, reset. Write actions publish commands; reads query Postgres.
- Wire it into `app/main.py` (TODOs already stubbed there): include the router and
  start/stop the Kafka producer in a FastAPI `lifespan`.

> **Create→read race (§14.2 / §26.3 #1, high priority).** In `POST /missions`,
> write the `missions` **and** `mission_control` rows to Postgres *synchronously
> before returning* the `mission_id`, **and** publish `CREATE_MISSION` to Kafka.
> Otherwise the UI's immediate `GET /missions/{id}` 404s.

**Checkpoint:** `[C7]`, then `POST /missions` → `GET /missions/{id}` returns the
mission; other commands appear in Redpanda Console (http://localhost:8080).

**→ migration: no. rebuild: no. restart: no** (the model layer is unchanged).

---

## Phase 5 — Pure simulation logic + unit tests

PRD §16.2–16.5, §18.21–18.24, §21. These are **pure functions** — no DB, no
Kafka. Unit-test them hard before wiring into workers.

- `app/services/pathfinding.py` — `find_path(start, target, width, height,
  blocked_cells)`, A* with Manhattan heuristic, returns `list[Point]` or `None`.
  Tests: empty grid → direct; mountain → detours; fully blocked → `None`;
  start==target → single-point path.
- `app/services/line_of_sight.py` — `cells_on_line(start, end)` +
  `has_line_of_sight(control, responder, mountain_cells)`. MC may be **off-grid**;
  only check in-grid cells; return the blocking cell when blocked. Tests: no
  mountains → connected; mountain on line → blocked; mountain off line →
  connected; MC outside grid works.
- `app/services/fire_service.py` — `apply_fire_tick(fire, responders_at_fire)`:
  `new = max(0, intensity - n*extinguish_rate)`; signals `FIRE_INTENSITY_CHANGED`
  and `FIRE_EXTINGUISHED` at 0.
- `app/services/signal_service.py` — recompute per-responder signal; surface
  `SIGNAL_LOST` / `SIGNAL_RESTORED` on change.

Run tests: `docker compose exec api pytest` (or `pytest` from `.venv`).

**→ migration: no. rebuild: no. restart: no.**

---

## Phase 6 — Workers: projector, then simulation

PRD §18.25–18.32, §16.1. Build the **projector first** (so you can see state
land in Postgres), then the simulation worker.

- `app/services/idempotency.py` — `already_processed(message_id, consumer_name)`
  and `mark_processed(...)` backed by the `processed_messages` unique constraint.
- `app/services/projection_service.py` — `apply_event(event)` with **one handler
  per event type** (full list in §18.25). Also insert into `mission_events`.
  Don't silently drop unknown types. Mind these handlers specifically:
  - `apply_mission_control_moved` → `UPDATE mission_control SET x,y` (else moving
    MC never persists; §26.3 #3).
  - `apply_route_not_found` → clear responder `assigned_fire_id`/`path`, set
    `idle`.
  - `apply_mission_reset` → clear fires/responders/mountain cells, reset MC to
    spawn; echo that spawn in the payload (§18.25, §26.2).
- `app/workers/projector_worker.py` — consumer group `state-projectors` on
  `mission.events.v1`: idempotency check → `apply_event` → mark processed →
  commit offset after success.
- `app/services/simulation_service.py` — `handle_command(command)` (one handler
  per command type) + `run_tick(mission_id)`. On dispatch, **emit
  `RESPONDER_DISPATCHED` first** (sets `assigned_fire_id`), then path → emit
  `RESPONDER_PATH_ASSIGNED`, or `ROUTE_NOT_FOUND` **on `mission.events.v1`** so
  the UI un-sticks the responder (§14.8, §26.3 #4/#6).
- `app/workers/simulation_worker.py` — consumer group `simulation-workers` on
  `mission.commands.v1`; same idempotency/commit discipline; failed commands →
  dead-letter topic.

> **Tick-loop ownership (§16.1 / §26.3 #11).** Keep authoritative responder
> position + `path_index` **in the simulation worker's memory** between ticks
> (rehydrate from Postgres on startup). The projector's Postgres write feeds the
> read model/API only — don't re-read live position from Postgres each 500ms tick
> or the worker races the projector and responders appear frozen.

**Checkpoint:** `[C8]` to start both workers, `[C9]` to watch logs. Run PRD
Demo 1 (create → place fire → create responder → dispatch → it moves → fire
extinguishes); `GET /missions/{id}` reflects each step.

**→ migration: no (tables exist). rebuild: no. restart: no** (`watchfiles`
reloads workers).

---

## Phase 7 — WebSocket live updates

PRD §15, §18.30, §26.2.

- `app/api/websocket.py` — `ConnectionManager` tracking clients by `mission_id`
  with `connect` / `disconnect` / `broadcast_to_mission`; endpoint
  `WS /ws/missions/{mission_id}`.
- Implement **all three** server→client messages: send a **`snapshot`** (full
  `MissionStateResponse`) as the **first frame on connect** (closes the GET↔WS
  gap), stream **`mission_event`** per event, and emit **`error`** strings.
- A broadcaster consumes `mission.events.v1` and fans events out to the right
  mission's sockets. (Validate WS `Origin` here if needed — CORS middleware does
  not cover the WS handshake, §18.2.)
- Flip the frontend to the real backend: set `NEXT_PUBLIC_MOCK=0` in `web`.

**Checkpoint:** UI updates live with no manual refresh.

**→ migration: no. rebuild: no. restart: no.**

---

## Phase 8 — (optional / post-MVP) reconnect + telemetry

PRD §18.27, §18.33, §20 Phase 8. Uses the Phase 1.8 outbox tables.

- On signal `blocked`, write simulated local updates to `responder_local_outbox`.
- On signal `restored`, flush the backlog to `responder.telemetry.v1`.
- `app/workers/telemetry_worker.py` + `app/services/reconciliation_service.py`
  consume the backlog and emit `RESPONDER_RECONNECTED` /
  `RESPONDER_POSITION_RECONCILED` (and fire reconciliation) to
  `mission.events.v1`; deliver `pending_responder_commands`.

**→ migration: no (outbox tables already created in Phase 1). rebuild: no.**

---

## Quick map: PRD → phase

| PRD section | Phase |
| --- | --- |
| §13, §18.5–18.10 (models) | 1 |
| §18.11–18.15, §26 (schemas/contract) | 2 |
| §18.16–18.18 (Kafka) | 3 |
| §14, §18.19/18.20/18.29 (API) | 4 |
| §16.2–16.5, §18.21–18.24 (pure sim) | 5 |
| §18.25–18.32, §16.1 (workers) | 6 |
| §15, §18.30 (WebSocket) | 7 |
| §18.27, §18.33 (reconnect) | 8 |
