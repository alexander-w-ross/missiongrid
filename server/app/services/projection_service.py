"""Projector: fold the event stream into the Postgres read model.

``apply_event`` dispatches each event to a handler that mutates current-state
tables, then records the event in ``mission_events`` (the history the API serves
as ``recent_events``). Every event type the simulation worker emits needs a
handler here, or current state drifts from the log.

Handlers are pure-ish: they take (db, mission_id, payload) and stage changes on
the session. The worker owns the transaction + offset commit.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select

from app.models import (
    Fire,
    Mission,
    MissionCell,
    MissionControl,
    MissionEvent,
    Responder,
)
from app.schemas.common import EventType, FireStatus, MissionStatus, ResponderStatus, SignalStatus
from app.services.mission_service import spawn_mission_control


def _parse_ts(value: str) -> datetime:
    """Envelope timestamps arrive as ISO strings; the column is TIMESTAMP
    (no tz), so normalise to naive UTC."""
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


# --- handlers (one per event type) ----------------------------------------

async def _mission_created(db, mission_id, p):
    # The API write-through usually created these already; only insert on a
    # cold replay where the read tables were truncated.
    if await db.get(Mission, UUID(mission_id)) is not None:
        return
    db.add(Mission(id=UUID(mission_id), name=p["name"], width=p["width"],
                   height=p["height"], status=MissionStatus.ACTIVE))
    sx, sy = spawn_mission_control(p["width"], p["height"])
    db.add(MissionControl(mission_id=UUID(mission_id), x=sx, y=sy))


async def _fire_created(db, mission_id, p):
    f = p["fire"]
    db.add(Fire(id=UUID(f["id"]), mission_id=UUID(mission_id), x=f["x"], y=f["y"],
                intensity=f["intensity"], status=f["status"]))


async def _mountain_placed(db, mission_id, p):
    db.add(MissionCell(mission_id=UUID(mission_id), x=p["x"], y=p["y"], terrain="mountain"))


async def _mountain_removed(db, mission_id, p):
    await db.execute(
        delete(MissionCell).where(
            MissionCell.mission_id == UUID(mission_id),
            MissionCell.x == p["x"], MissionCell.y == p["y"],
            MissionCell.terrain == "mountain",
        )
    )


async def _responder_created(db, mission_id, p):
    r = p["responder"]
    db.add(Responder(
        id=UUID(r["id"]), mission_id=UUID(mission_id), name=r["name"],
        x=r["x"], y=r["y"], last_known_x=r["last_known_x"], last_known_y=r["last_known_y"],
        status=r["status"], signal_status=r["signal_status"],
        assigned_fire_id=UUID(r["assigned_fire_id"]) if r.get("assigned_fire_id") else None,
        path_json=r.get("path"), path_index=r.get("path_index", 0),
    ))


async def _responder_dispatched(db, mission_id, p):
    r = await db.get(Responder, UUID(p["responder_id"]))
    r.assigned_fire_id = UUID(p["fire_id"])
    r.status = ResponderStatus.MOVING


async def _responder_path_assigned(db, mission_id, p):
    r = await db.get(Responder, UUID(p["responder_id"]))
    r.path_json = p["path"]
    r.path_index = 0
    r.status = ResponderStatus.MOVING


async def _responder_moved(db, mission_id, p):
    r = await db.get(Responder, UUID(p["responder_id"]))
    r.x, r.y = p["position"]["x"], p["position"]["y"]
    r.last_known_x, r.last_known_y = p["last_known"]["x"], p["last_known"]["y"]
    r.path_index = p["path_index"]
    r.status = p["status"]
    r.signal_status = p["signal_status"]


async def _signal_lost(db, mission_id, p):
    r = await db.get(Responder, UUID(p["responder_id"]))
    r.signal_status = SignalStatus.BLOCKED
    r.last_known_x, r.last_known_y = p["last_known"]["x"], p["last_known"]["y"]


async def _signal_restored(db, mission_id, p):
    r = await db.get(Responder, UUID(p["responder_id"]))
    r.signal_status = SignalStatus.CONNECTED
    r.last_known_x, r.last_known_y = p["position"]["x"], p["position"]["y"]


async def _fire_intensity_changed(db, mission_id, p):
    f = await db.get(Fire, UUID(p["fire_id"]))
    f.intensity = p["intensity"]
    f.status = p["status"]


async def _fire_extinguished(db, mission_id, p):
    f = await db.get(Fire, UUID(p["fire_id"]))
    f.intensity = 0
    f.status = FireStatus.EXTINGUISHED
    f.extinguished_at = datetime.now(timezone.utc).replace(tzinfo=None)


async def _route_not_found(db, mission_id, p):
    r = await db.get(Responder, UUID(p["responder_id"]))
    r.assigned_fire_id = None
    r.path_json = None
    r.status = ResponderStatus.IDLE


async def _mission_control_moved(db, mission_id, p):
    mc = (await db.scalars(
        select(MissionControl).where(MissionControl.mission_id == UUID(mission_id)))).first()
    mc.x, mc.y = p["x"], p["y"]


async def _mission_reset(db, mission_id, p):
    mid = UUID(mission_id)
    await db.execute(delete(Fire).where(Fire.mission_id == mid))
    await db.execute(delete(Responder).where(Responder.mission_id == mid))
    await db.execute(delete(MissionCell).where(MissionCell.mission_id == mid))
    mc = (await db.scalars(
        select(MissionControl).where(MissionControl.mission_id == mid))).first()
    mc.x, mc.y = p["mission_control"]["x"], p["mission_control"]["y"]


async def _responder_reconnected(db, mission_id, p):
    r = await db.get(Responder, UUID(p["responder_id"]))
    r.signal_status = SignalStatus.CONNECTED


async def _responder_position_reconciled(db, mission_id, p):
    r = await db.get(Responder, UUID(p["responder_id"]))
    r.x, r.y = p["position"]["x"], p["position"]["y"]
    r.last_known_x, r.last_known_y = p["position"]["x"], p["position"]["y"]


HANDLERS = {
    EventType.MISSION_CREATED: _mission_created,
    EventType.FIRE_CREATED: _fire_created,
    EventType.MOUNTAIN_PLACED: _mountain_placed,
    EventType.MOUNTAIN_REMOVED: _mountain_removed,
    EventType.RESPONDER_CREATED: _responder_created,
    EventType.RESPONDER_DISPATCHED: _responder_dispatched,
    EventType.RESPONDER_PATH_ASSIGNED: _responder_path_assigned,
    EventType.RESPONDER_MOVED: _responder_moved,
    EventType.SIGNAL_LOST: _signal_lost,
    EventType.SIGNAL_RESTORED: _signal_restored,
    EventType.FIRE_INTENSITY_CHANGED: _fire_intensity_changed,
    EventType.FIRE_EXTINGUISHED: _fire_extinguished,
    EventType.ROUTE_NOT_FOUND: _route_not_found,
    EventType.MISSION_CONTROL_MOVED: _mission_control_moved,
    EventType.MISSION_RESET: _mission_reset,
    EventType.RESPONDER_RECONNECTED: _responder_reconnected,
    EventType.RESPONDER_POSITION_RECONCILED: _responder_position_reconciled,
}


async def apply_event(db, event: dict) -> None:
    """Apply one event to the read model and record it in mission_events."""
    handler = HANDLERS.get(event["type"])
    if handler is None:
        # Never silently drop — an unhandled type means state will drift.
        raise ValueError(f"no projection handler for event type {event['type']!r}")

    await handler(db, event["mission_id"], event["payload"])

    db.add(MissionEvent(
        id=UUID(event["id"]),
        mission_id=UUID(event["mission_id"]),
        type=event["type"],
        payload=event["payload"],
        occurred_at=_parse_ts(event["occurred_at"]),
    ))
