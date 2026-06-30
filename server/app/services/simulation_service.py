"""The simulation brain: commands -> events, plus the per-tick world update.

The worker holds an in-memory ``world`` (mission_id -> MissionStateLocal) that is
the AUTHORITATIVE live position of everything between ticks. It's rehydrated from
Postgres on startup. The projector's Postgres writes are downstream of the events
emitted here — never read live position back from the DB inside a tick, or the
two workers race.

handle_command / run_tick are pure functions over the in-memory world (no DB, no
Kafka); the worker awaits the publishing.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models import Fire, Mission, MissionCell, MissionControl, Responder
from app.schemas.common import (
    CommandType,
    EventType,
    FireStatus,
    Point,
    ResponderStatus,
    SignalStatus,
)
from app.schemas.events import (
    EventEnvelope,
    FireCreatedPayload,
    FireExtinguishedPayload,
    FireIntensityChangedPayload,
    MissionControlMovedPayload,
    MissionCreatedPayload,
    MissionResetPayload,
    MountainPlacedPayload,
    MountainRemovedPayload,
    ResponderCreatedPayload,
    ResponderDispatchedPayload,
    ResponderMovedPayload,
    ResponderPathAssignedPayload,
    RouteNotFoundPayload,
    SignalLostPayload,
    SignalRestoredPayload,
)
from app.schemas.mission import FireResponse, ResponderResponse
from app.services.fire_service import apply_fire_tick
from app.services.mission_service import spawn_mission_control
from app.services.pathfinding import find_path
from app.services.signal_service import compute_signal_status

Cell = tuple[int, int]


# --- in-memory world ------------------------------------------------------

@dataclass
class ResponderState:
    id: str
    name: str
    x: int
    y: int
    last_known_x: int
    last_known_y: int
    status: str = ResponderStatus.IDLE
    signal_status: str = SignalStatus.CONNECTED
    assigned_fire_id: str | None = None
    path: list[Cell] | None = None
    path_index: int = 0
    # Moves made while signal is blocked, buffered locally until reconnect
    # (the advanced disconnected-responder flow). The worker flushes these to
    # responder.telemetry.v1 once the responder reconnects.
    local_log: list[dict] = field(default_factory=list)


@dataclass
class FireStateLocal:
    id: str
    x: int
    y: int
    intensity: int
    status: str = FireStatus.ACTIVE


@dataclass
class MissionStateLocal:
    mission_id: str
    width: int
    height: int
    control: Cell
    mountains: set[Cell] = field(default_factory=set)
    fires: dict[str, FireStateLocal] = field(default_factory=dict)
    responders: dict[str, ResponderState] = field(default_factory=dict)


World = dict[str, MissionStateLocal]


# --- helpers --------------------------------------------------------------

def _event(type_, mission_id, payload, *, correlation_id=None, causation_id=None) -> EventEnvelope:
    return EventEnvelope(
        id=str(uuid4()),  # plain UUID -> fits MissionEvent.id
        type=type_,
        mission_id=mission_id,
        correlation_id=correlation_id,
        causation_id=causation_id,
        occurred_at=datetime.now(timezone.utc),
        payload=payload.model_dump(mode="json"),
    )


def _responder_response(r: ResponderState) -> ResponderResponse:
    return ResponderResponse(
        id=UUID(r.id), name=r.name, x=r.x, y=r.y,
        last_known_x=r.last_known_x, last_known_y=r.last_known_y,
        status=r.status, signal_status=r.signal_status,
        assigned_fire_id=UUID(r.assigned_fire_id) if r.assigned_fire_id else None,
        path=[Point(x=c[0], y=c[1]) for c in r.path] if r.path else None,
        path_index=r.path_index,
    )


def _recompute_all_signals(mission: MissionStateLocal, make) -> list[EventEnvelope]:
    """Recompute every responder's signal after the mountains or mission control
    changed; emit SIGNAL_LOST / SIGNAL_RESTORED only when it actually flips."""
    out: list[EventEnvelope] = []
    for r in mission.responders.values():
        status, blocked_by = compute_signal_status(mission.control, (r.x, r.y), mission.mountains)
        if status == r.signal_status:
            continue
        r.signal_status = status
        if status == SignalStatus.BLOCKED:
            out.append(make(EventType.SIGNAL_LOST, SignalLostPayload(
                responder_id=r.id,
                last_known=Point(x=r.last_known_x, y=r.last_known_y),  # frozen
                blocked_by=Point(x=blocked_by[0], y=blocked_by[1]),
            )))
        else:
            r.last_known_x, r.last_known_y = r.x, r.y
            out.append(make(EventType.SIGNAL_RESTORED, SignalRestoredPayload(
                responder_id=r.id, position=Point(x=r.x, y=r.y),
            )))
    return out


# --- command handling -----------------------------------------------------

def handle_command(cmd: dict, world: World) -> list[EventEnvelope]:
    """Turn one command into the events it causes (mutating the in-memory world)."""
    type_ = cmd["type"]
    mid = cmd["mission_id"]
    p = cmd["payload"]
    make = lambda t, payload: _event(
        t, mid, payload, correlation_id=cmd.get("correlation_id"), causation_id=cmd.get("id")
    )

    if type_ == CommandType.CREATE_MISSION:
        if mid not in world:  # don't clobber a rehydrated mission on replay
            sx, sy = spawn_mission_control(p["width"], p["height"])
            world[mid] = MissionStateLocal(mission_id=mid, width=p["width"], height=p["height"], control=(sx, sy))
        return [make(EventType.MISSION_CREATED, MissionCreatedPayload(
            name=p["name"], width=p["width"], height=p["height"]))]

    mission = world.get(mid)
    if mission is None:
        return []  # defensive: CREATE_MISSION always precedes others on the same partition

    if type_ == CommandType.PLACE_FIRE:
        fid = str(uuid4())
        fire = FireStateLocal(id=fid, x=p["x"], y=p["y"], intensity=p.get("intensity", 100))
        mission.fires[fid] = fire
        return [make(EventType.FIRE_CREATED, FireCreatedPayload(fire=FireResponse(
            id=UUID(fid), x=fire.x, y=fire.y, intensity=fire.intensity, status=fire.status)))]

    if type_ == CommandType.PLACE_MOUNTAIN:
        mission.mountains.add((p["x"], p["y"]))
        events = [make(EventType.MOUNTAIN_PLACED, MountainPlacedPayload(x=p["x"], y=p["y"]))]
        return events + _recompute_all_signals(mission, make)

    if type_ == CommandType.REMOVE_MOUNTAIN:
        mission.mountains.discard((p["x"], p["y"]))
        events = [make(EventType.MOUNTAIN_REMOVED, MountainRemovedPayload(x=p["x"], y=p["y"]))]
        return events + _recompute_all_signals(mission, make)

    if type_ == CommandType.CREATE_RESPONDER:
        rid = str(uuid4())
        r = ResponderState(id=rid, name=p["name"], x=p["x"], y=p["y"],
                           last_known_x=p["x"], last_known_y=p["y"])
        mission.responders[rid] = r
        return [make(EventType.RESPONDER_CREATED, ResponderCreatedPayload(responder=_responder_response(r)))]

    if type_ == CommandType.DISPATCH_RESPONDER:
        rid, fid = p["responder_id"], p["fire_id"]
        r, fire = mission.responders.get(rid), mission.fires.get(fid)
        if r is None or fire is None:
            return []
        r.assigned_fire_id = fid
        r.status = ResponderStatus.MOVING
        events = [make(EventType.RESPONDER_DISPATCHED, ResponderDispatchedPayload(responder_id=rid, fire_id=fid))]
        path = find_path((r.x, r.y), (fire.x, fire.y), mission.width, mission.height, mission.mountains)
        if path is None:
            r.status = ResponderStatus.IDLE
            r.assigned_fire_id = None
            events.append(make(EventType.ROUTE_NOT_FOUND, RouteNotFoundPayload(responder_id=rid, fire_id=fid)))
        else:
            r.path, r.path_index = path, 0
            events.append(make(EventType.RESPONDER_PATH_ASSIGNED, ResponderPathAssignedPayload(
                responder_id=rid, path=[Point(x=c[0], y=c[1]) for c in path])))
        return events

    if type_ == CommandType.MOVE_MISSION_CONTROL:
        mission.control = (p["x"], p["y"])
        events = [make(EventType.MISSION_CONTROL_MOVED, MissionControlMovedPayload(x=p["x"], y=p["y"]))]
        return events + _recompute_all_signals(mission, make)

    if type_ == CommandType.RESET_MISSION:
        sx, sy = spawn_mission_control(mission.width, mission.height)
        mission.mountains.clear()
        mission.fires.clear()
        mission.responders.clear()
        mission.control = (sx, sy)
        return [make(EventType.MISSION_RESET, MissionResetPayload(mission_control=Point(x=sx, y=sy)))]

    return []


# --- the tick -------------------------------------------------------------

def run_tick(mission_id: str, world: World) -> list[EventEnvelope]:
    """Advance one mission by one tick: move responders, recheck signal, burn fires."""
    mission = world.get(mission_id)
    if mission is None:
        return []
    events: list[EventEnvelope] = []
    make = lambda t, payload: _event(t, mission_id, payload)

    # 1) move each en-route responder one cell along its path
    for r in mission.responders.values():
        if r.status != ResponderStatus.MOVING or not r.path or r.path_index >= len(r.path) - 1:
            continue
        r.path_index += 1
        r.x, r.y = r.path[r.path_index]
        if r.path_index == len(r.path) - 1:
            r.status = ResponderStatus.FIGHTING_FIRE

        status, blocked_by = compute_signal_status(mission.control, (r.x, r.y), mission.mountains)
        previous = r.signal_status
        r.signal_status = status

        if status == SignalStatus.BLOCKED:
            # Central is dark: buffer the move locally instead of emitting it, and
            # leave last_known frozen at the last cell control actually saw.
            r.local_log.append({"x": r.x, "y": r.y})
            if previous == SignalStatus.CONNECTED:
                events.append(make(EventType.SIGNAL_LOST, SignalLostPayload(
                    responder_id=r.id,
                    last_known=Point(x=r.last_known_x, y=r.last_known_y),
                    blocked_by=Point(x=blocked_by[0], y=blocked_by[1]))))
            continue

        # Connected: central sees the live move.
        r.last_known_x, r.last_known_y = r.x, r.y
        events.append(make(EventType.RESPONDER_MOVED, ResponderMovedPayload(
            responder_id=r.id,
            position=Point(x=r.x, y=r.y),
            last_known=Point(x=r.last_known_x, y=r.last_known_y),
            path_index=r.path_index,
            status=r.status,
            signal_status=r.signal_status,
        )))
        if previous == SignalStatus.BLOCKED:
            # Just reconnected — the worker flushes r.local_log to telemetry for
            # reconciliation; emit the restore so the UI clears the alert.
            events.append(make(EventType.SIGNAL_RESTORED, SignalRestoredPayload(
                responder_id=r.id, position=Point(x=r.x, y=r.y))))

    # 2) burn down fires that have responders standing on them
    for fire in mission.fires.values():
        if fire.status != FireStatus.ACTIVE:
            continue
        crew = sum(1 for r in mission.responders.values() if (r.x, r.y) == (fire.x, fire.y))
        if crew == 0:
            continue
        new_intensity = apply_fire_tick(fire.intensity, crew)
        if new_intensity == fire.intensity:
            continue
        fire.intensity = new_intensity
        if new_intensity == 0:
            fire.status = FireStatus.EXTINGUISHED
            events.append(make(EventType.FIRE_INTENSITY_CHANGED, FireIntensityChangedPayload(
                fire_id=fire.id, intensity=0, status=FireStatus.EXTINGUISHED)))
            events.append(make(EventType.FIRE_EXTINGUISHED, FireExtinguishedPayload(fire_id=fire.id)))
        else:
            events.append(make(EventType.FIRE_INTENSITY_CHANGED, FireIntensityChangedPayload(
                fire_id=fire.id, intensity=new_intensity, status=FireStatus.ACTIVE)))

    return events


# --- startup --------------------------------------------------------------

async def rehydrate() -> World:
    """Rebuild the in-memory world from Postgres on worker startup/restart."""
    world: World = {}
    async with AsyncSessionLocal() as db:
        for m in (await db.scalars(select(Mission))).all():
            mid = str(m.id)
            mc = (await db.scalars(
                select(MissionControl).where(MissionControl.mission_id == m.id))).first()
            control = (mc.x, mc.y) if mc else spawn_mission_control(m.width, m.height)
            state = MissionStateLocal(mission_id=mid, width=m.width, height=m.height, control=control)

            cells = (await db.scalars(select(MissionCell).where(
                MissionCell.mission_id == m.id, MissionCell.terrain == "mountain"))).all()
            state.mountains = {(c.x, c.y) for c in cells}

            for f in (await db.scalars(select(Fire).where(Fire.mission_id == m.id))).all():
                state.fires[str(f.id)] = FireStateLocal(
                    id=str(f.id), x=f.x, y=f.y, intensity=f.intensity, status=f.status)

            for r in (await db.scalars(select(Responder).where(Responder.mission_id == m.id))).all():
                path = [(pt["x"], pt["y"]) for pt in r.path_json] if r.path_json else None
                state.responders[str(r.id)] = ResponderState(
                    id=str(r.id), name=r.name, x=r.x, y=r.y,
                    last_known_x=r.last_known_x, last_known_y=r.last_known_y,
                    status=r.status, signal_status=r.signal_status,
                    assigned_fire_id=str(r.assigned_fire_id) if r.assigned_fire_id else None,
                    path=path, path_index=r.path_index)

            world[mid] = state
    return world
