"""WebSocket message schemas for /ws/missions/{mission_id}.

Server -> client has three shapes, discriminated on `type`:
  * snapshot      — full current state, sent as the first frame on connect
  * mission_event — one official event, forwarded from mission.events.v1
  * error         — a human-readable error string

Client -> server is HTTP-first for the MVP; the optional `command` message lets
the UI send commands over the socket instead.
"""

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from app.schemas.common import CommandType
from app.schemas.events import EventEnvelope
from app.schemas.mission import MissionStateResponse


# --- server -> client -----------------------------------------------------

class SnapshotMessage(BaseModel):
    type: Literal["snapshot"] = "snapshot"
    state: MissionStateResponse


class MissionEventMessage(BaseModel):
    type: Literal["mission_event"] = "mission_event"
    event: EventEnvelope


class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    message: str


# Discriminated union: parse/serialize any server->client frame by its `type`.
ServerMessage = Annotated[
    Union[SnapshotMessage, MissionEventMessage, ErrorMessage],
    Field(discriminator="type"),
]


# --- client -> server (optional) ------------------------------------------

class InboundCommand(BaseModel):
    type: CommandType
    payload: dict


class CommandMessage(BaseModel):
    type: Literal["command"] = "command"
    command: InboundCommand
