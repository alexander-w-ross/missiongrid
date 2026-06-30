from uuid import uuid4
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.commands import (
    CreateMissionPayload, PlaceFirePayload, PlaceMountainPayload,
    CreateResponderPayload, DispatchResponderPayload, MoveMissionControlPayload,
)
from app.schemas.common import CommandType
from app.services import command_service, mission_service

router = APIRouter()


class DispatchRequest(BaseModel):     # body is just {fire_id}; responder_id is in the URL
    fire_id: str


@router.post("/missions")
async def create_mission(body: CreateMissionPayload, db: AsyncSession = Depends(get_db)):
    mission_id = str(uuid4())
    # Write-through: persist the missions + mission_control rows now so the UI's
    # immediate GET doesn't 404, then publish the event for the log.
    await mission_service.create_mission_rows(db, mission_id, body)
    await command_service.send_command(CommandType.CREATE_MISSION, mission_id, body.model_dump())
    return {"mission_id": mission_id}

@router.get("/missions/{mission_id}")
async def get_mission(mission_id: str, db: AsyncSession = Depends(get_db)):
    return await mission_service.get_mission_state(db, mission_id)


@router.post("/missions/{mission_id}/fires")
async def place_fire(mission_id: str, body: PlaceFirePayload):
    env = await command_service.send_command(CommandType.PLACE_FIRE, mission_id, body.model_dump())
    return {"command_id": env.id}


@router.post("/missions/{mission_id}/mountains")
async def place_mountain(mission_id: str, body: PlaceMountainPayload):
    env = await command_service.send_command(CommandType.PLACE_MOUNTAIN, mission_id, body.model_dump())
    return {"command_id": env.id}


@router.delete("/missions/{mission_id}/mountains/{x}/{y}")
async def remove_mountain(mission_id: str, x: int, y: int):
    # x/y come from the URL; build the payload by hand.
    env = await command_service.send_command(
        CommandType.REMOVE_MOUNTAIN, mission_id, {"x": x, "y": y}
    )
    return {"command_id": env.id}


@router.post("/missions/{mission_id}/responders")
async def create_responder(mission_id: str, body: CreateResponderPayload):
    env = await command_service.send_command(CommandType.CREATE_RESPONDER, mission_id, body.model_dump())
    return {"command_id": env.id}


@router.post("/missions/{mission_id}/responders/{responder_id}/dispatch")
async def dispatch_responder(mission_id: str, responder_id: str, body: DispatchRequest):
    # responder_id is in the URL, fire_id in the body; the command carries both.
    payload = DispatchResponderPayload(responder_id=responder_id, fire_id=body.fire_id)
    env = await command_service.send_command(
        CommandType.DISPATCH_RESPONDER, mission_id, payload.model_dump()
    )
    return {"command_id": env.id}


@router.post("/missions/{mission_id}/mission-control/move")
async def move_mission_control(mission_id: str, body: MoveMissionControlPayload):
    env = await command_service.send_command(
        CommandType.MOVE_MISSION_CONTROL, mission_id, body.model_dump()
    )
    return {"command_id": env.id}


@router.post("/missions/{mission_id}/reset")
async def reset_mission(mission_id: str):
    # No body — reset takes no payload.
    env = await command_service.send_command(CommandType.RESET_MISSION, mission_id, {})
    return {"command_id": env.id}

