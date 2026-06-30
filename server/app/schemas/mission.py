"""Response models the API returns and the frontend renders from.

These field names ARE the wire contract the UI reducer reads — keep them
snake_case and don't rename them. `from_attributes=True` lets each model be
built straight from a SQLAlchemy row with `Model.model_validate(orm_row)`.
"""

from datetime import datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.schemas.common import (
    EventType,
    FireStatus,
    MissionStatus,
    Point,
    ResponderStatus,
    SignalStatus,
    Terrain,
)


class CellResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    x: int
    y: int
    terrain: Terrain


class FireResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    x: int
    y: int
    intensity: int
    status: FireStatus


class ResponderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    name: str
    x: int
    y: int
    last_known_x: int
    last_known_y: int
    status: ResponderStatus
    signal_status: SignalStatus
    assigned_fire_id: UUID | None = None
    # Serializes as "path"; reads from the ORM column "path_json" (or "path" from
    # a plain dict) so model_validate(orm_responder) picks the stored path up.
    path: list[Point] | None = Field(
        default=None, validation_alias=AliasChoices("path", "path_json")
    )
    path_index: int = 0


class MissionControlResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    x: int
    y: int


class RecentEventResponse(BaseModel):
    """One row from mission_events, shaped like the envelope the event log reads."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: EventType
    mission_id: UUID
    correlation_id: UUID | None = None
    causation_id: UUID | None = None
    occurred_at: datetime
    payload: dict


class MissionStateResponse(BaseModel):
    """Everything the UI needs to draw a mission in one read (GET /missions/{id})."""

    mission_id: UUID
    name: str
    width: int
    height: int
    status: MissionStatus
    mission_control: MissionControlResponse
    cells: list[CellResponse]
    fires: list[FireResponse]
    responders: list[ResponderResponse]
    recent_events: list[RecentEventResponse]  # newest-first
