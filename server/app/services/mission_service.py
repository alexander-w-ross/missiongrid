from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, desc

from app.models import Mission, MissionCell, Fire, Responder, MissionControl, MissionEvent
from app.schemas.commands import CreateMissionPayload
from app.schemas.common import MissionStatus
from app.schemas.mission import (
    MissionStateResponse, CellResponse, FireResponse, ResponderResponse,
    MissionControlResponse, RecentEventResponse,
)


def spawn_mission_control(width: int, height: int) -> tuple[int, int]:
    """Deterministic mission-control spawn: just off the left edge, vertically
    centered. Reused by the MISSION_RESET handler so the marker returns to the
    exact same spot the mission started at."""
    return (-2, height // 2)


async def create_mission_rows(db, mission_id: str, body: CreateMissionPayload) -> None:
    """Write-through for POST /missions: synchronously persist the mission and its
    mission_control row so the UI's immediate GET doesn't 404. CREATE_MISSION is
    still published to Kafka for the event log. Only these two rows are written
    here — fires/mountains/responders arrive later via the event pipeline."""
    mid = UUID(mission_id)
    db.add(
        Mission(
            id=mid,
            name=body.name,
            width=body.width,
            height=body.height,
            status=MissionStatus.ACTIVE,
        )
    )
    sx, sy = spawn_mission_control(body.width, body.height)
    db.add(MissionControl(mission_id=mid, x=sx, y=sy))
    await db.commit()


async def get_mission_state(db, mission_id: str) -> MissionStateResponse:
    mission = await db.get(Mission, mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="mission not found")
    
    cells = (await db.scalars(
        select(MissionCell).where(MissionCell.mission_id == mission_id, MissionCell.terrain == "mountain")
    )).all()
    
    fires = (await db.scalars(select(Fire).where(Fire.mission_id == mission_id))).all()
    responders = (await db.scalars(select(Responder).where(Responder.mission_id == mission_id))).all()
    mc = (await db.scalars(select(MissionControl).where(MissionControl.mission_id == mission_id))).first()
    events = (await db.scalars(
        select(MissionEvent).where(MissionEvent.mission_id == mission_id).order_by(desc(MissionEvent.occurred_at)).limit(50)
    )).all()
    
    return MissionStateResponse(
        mission_id=mission.id, name=mission.name, width=mission.width,
        height=mission.height, status=mission.status,
        mission_control=MissionControlResponse.model_validate(mc),
        cells=[CellResponse.model_validate(c) for c in cells],
        fires=[FireResponse.model_validate(f) for f in fires],
        responders=[ResponderResponse.model_validate(r) for r in responders],  # path_json -> path via alias
        recent_events=[RecentEventResponse.model_validate(e) for e in events],
    )