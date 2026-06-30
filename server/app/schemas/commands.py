"""Command schemas — the *intentions* the API publishes to mission.commands.v1.

A command is an envelope (id / type / routing / lineage) wrapping a typed
payload. The HTTP handler validates the request body into one of the payload
classes, then wraps it: `CommandEnvelope(..., payload=payload.model_dump())`.
The simulation worker is what turns these into events.
"""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import CommandType


class CommandEnvelope(BaseModel):
    id: str
    type: CommandType
    schema_version: int = 1
    mission_id: str | None = None  # None only for CREATE_MISSION (no id yet)
    actor_id: str = "demo-user"
    correlation_id: str  # shared by every command/event from one user action
    created_at: datetime
    payload: dict


# --- payloads (one per command type) --------------------------------------

class CreateMissionPayload(BaseModel):
    name: str
    width: int
    height: int


class PlaceFirePayload(BaseModel):
    x: int
    y: int
    intensity: int = 100


class PlaceMountainPayload(BaseModel):
    x: int
    y: int


class RemoveMountainPayload(BaseModel):
    x: int
    y: int


class CreateResponderPayload(BaseModel):
    name: str
    x: int
    y: int


class DispatchResponderPayload(BaseModel):
    # responder_id comes from the URL path, fire_id from the request body; the
    # canonical command carries both so the worker has everything it needs.
    responder_id: str
    fire_id: str


class MoveMissionControlPayload(BaseModel):
    x: int  # may be negative / off-grid
    y: int


class ResetMissionPayload(BaseModel):
    pass
