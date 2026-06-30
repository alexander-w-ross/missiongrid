"""Event schemas — the *facts* the simulation worker emits to mission.events.v1.

The projector consumes these to update Postgres and the WebSocket broadcaster
forwards them to the UI. The payload field names (and the NESTED position /
last_known / fire / responder objects) are exactly what the frontend reducer
reads — don't flatten them.
"""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import (
    EventType,
    FireStatus,
    Point,
    ResponderStatus,
    SignalStatus,
)
from app.schemas.mission import FireResponse, ResponderResponse


class EventEnvelope(BaseModel):
    id: str
    type: EventType
    schema_version: int = 1
    mission_id: str
    actor_id: str = "system"
    correlation_id: str | None = None  # traces the whole originating user action
    causation_id: str | None = None  # the immediate parent command/event id
    occurred_at: datetime
    payload: dict


# --- payloads (one per event type) ----------------------------------------

class MissionCreatedPayload(BaseModel):
    name: str
    width: int
    height: int


class FireCreatedPayload(BaseModel):
    fire: FireResponse  # the whole fire object, not flat x/y


class MountainPlacedPayload(BaseModel):
    x: int
    y: int


class MountainRemovedPayload(BaseModel):
    x: int
    y: int


class ResponderCreatedPayload(BaseModel):
    responder: ResponderResponse


class ResponderDispatchedPayload(BaseModel):
    responder_id: str
    fire_id: str


class ResponderPathAssignedPayload(BaseModel):
    responder_id: str
    path: list[Point]


class ResponderMovedPayload(BaseModel):
    responder_id: str
    position: Point
    last_known: Point  # equals position while connected; frozen while blocked
    path_index: int
    status: ResponderStatus
    signal_status: SignalStatus


class SignalLostPayload(BaseModel):
    responder_id: str
    last_known: Point
    blocked_by: Point  # the mountain cell that broke line-of-sight


class SignalRestoredPayload(BaseModel):
    responder_id: str
    position: Point


class FireIntensityChangedPayload(BaseModel):
    fire_id: str
    intensity: int
    status: FireStatus


class FireExtinguishedPayload(BaseModel):
    fire_id: str


class RouteNotFoundPayload(BaseModel):
    responder_id: str
    fire_id: str


class MissionControlMovedPayload(BaseModel):
    x: int
    y: int


class MissionResetPayload(BaseModel):
    mission_control: Point  # the post-reset spawn so the UI relocates the marker


class ResponderReconnectedPayload(BaseModel):
    responder_id: str


class ResponderPositionReconciledPayload(BaseModel):
    responder_id: str
    position: Point
