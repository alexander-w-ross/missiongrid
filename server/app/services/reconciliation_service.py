"""Turn an uploaded responder-telemetry backlog into official mission events.

When a blocked responder reconnects, the simulation worker flushes its buffered
moves to responder.telemetry.v1. The telemetry worker hands each upload here to
produce the official catch-up events for mission.events.v1.
"""

from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.common import EventType, Point
from app.schemas.events import (
    EventEnvelope,
    ResponderPositionReconciledPayload,
    ResponderReconnectedPayload,
)


def _event(type_, mission_id: str, payload) -> EventEnvelope:
    return EventEnvelope(
        id=str(uuid4()),
        type=type_,
        mission_id=mission_id,
        occurred_at=datetime.now(timezone.utc),
        payload=payload.model_dump(mode="json"),
    )


def build_reconciliation_events(telemetry: dict) -> list[EventEnvelope]:
    """Given one uploaded backlog, emit RESPONDER_RECONNECTED then
    RESPONDER_POSITION_RECONCILED (snapping central state to the responder's
    true position at the moment it reconnected)."""
    responder_id = telemetry["responder_id"]
    mission_id = telemetry["mission_id"]
    position = telemetry["final_position"]
    return [
        _event(EventType.RESPONDER_RECONNECTED, mission_id,
               ResponderReconnectedPayload(responder_id=responder_id)),
        _event(EventType.RESPONDER_POSITION_RECONCILED, mission_id,
               ResponderPositionReconciledPayload(
                   responder_id=responder_id,
                   position=Point(x=position["x"], y=position["y"]))),
    ]
