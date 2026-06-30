"""Shared Pydantic primitives and enums.

`StrEnum` members ARE strings, so they serialize to their lowercase value in
JSON / Kafka / API responses (unlike a plain `Enum`, whose `str()` would emit
`"Terrain.MOUNTAIN"`). The values below match the frontend contract exactly —
do not rename them.
"""

from enum import StrEnum

from pydantic import BaseModel


# --- domain enums ---------------------------------------------------------

class Terrain(StrEnum):
    EMPTY = "empty"
    MOUNTAIN = "mountain"


class MissionStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class FireStatus(StrEnum):
    ACTIVE = "active"
    CONTAINED = "contained"
    EXTINGUISHED = "extinguished"


class ResponderStatus(StrEnum):
    IDLE = "idle"
    MOVING = "moving"
    FIGHTING_FIRE = "fighting_fire"
    RETURNING = "returning"
    DISCONNECTED = "disconnected"


class SignalStatus(StrEnum):
    CONNECTED = "connected"
    BLOCKED = "blocked"
    RECONNECTING = "reconnecting"


# --- message-type enums (the strings flying through Kafka) ----------------

class CommandType(StrEnum):
    CREATE_MISSION = "CREATE_MISSION"
    PLACE_FIRE = "PLACE_FIRE"
    PLACE_MOUNTAIN = "PLACE_MOUNTAIN"
    REMOVE_MOUNTAIN = "REMOVE_MOUNTAIN"
    CREATE_RESPONDER = "CREATE_RESPONDER"
    DISPATCH_RESPONDER = "DISPATCH_RESPONDER"
    MOVE_MISSION_CONTROL = "MOVE_MISSION_CONTROL"
    RESET_MISSION = "RESET_MISSION"


class EventType(StrEnum):
    MISSION_CREATED = "MISSION_CREATED"
    FIRE_CREATED = "FIRE_CREATED"
    MOUNTAIN_PLACED = "MOUNTAIN_PLACED"
    MOUNTAIN_REMOVED = "MOUNTAIN_REMOVED"
    RESPONDER_CREATED = "RESPONDER_CREATED"
    RESPONDER_DISPATCHED = "RESPONDER_DISPATCHED"
    RESPONDER_PATH_ASSIGNED = "RESPONDER_PATH_ASSIGNED"
    RESPONDER_MOVED = "RESPONDER_MOVED"
    SIGNAL_LOST = "SIGNAL_LOST"
    SIGNAL_RESTORED = "SIGNAL_RESTORED"
    FIRE_INTENSITY_CHANGED = "FIRE_INTENSITY_CHANGED"
    FIRE_EXTINGUISHED = "FIRE_EXTINGUISHED"
    ROUTE_NOT_FOUND = "ROUTE_NOT_FOUND"
    MISSION_CONTROL_MOVED = "MISSION_CONTROL_MOVED"
    MISSION_RESET = "MISSION_RESET"
    RESPONDER_RECONNECTED = "RESPONDER_RECONNECTED"
    RESPONDER_POSITION_RECONCILED = "RESPONDER_POSITION_RECONCILED"


# --- shared value objects -------------------------------------------------

class Point(BaseModel):
    x: int
    y: int


class GridSize(BaseModel):
    width: int
    height: int
