"""WebSocket gateway: live mission updates for /ws/missions/{mission_id}.

On connect a client gets one `snapshot` (the full current state, so it doesn't
need a separate GET), then a stream of `mission_event` frames. A single
background broadcaster consumes mission.events.v1 and fans each event out to the
sockets connected for that mission.
"""

import asyncio
import logging
from uuid import uuid4

from aiokafka import AIOKafkaConsumer
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.db.session import AsyncSessionLocal
from app.kafka.serialization import deserialize
from app.kafka.topics import MISSION_EVENTS_TOPIC
from app.schemas.websocket import ErrorMessage, MissionEventMessage, SnapshotMessage
from app.services.mission_service import get_mission_state

log = logging.getLogger("websocket")

router = APIRouter()


class ConnectionManager:
    """Tracks open sockets grouped by mission id."""

    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, mission_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.rooms.setdefault(mission_id, set()).add(ws)

    def disconnect(self, mission_id: str, ws: WebSocket) -> None:
        room = self.rooms.get(mission_id)
        if room:
            room.discard(ws)
            if not room:
                self.rooms.pop(mission_id, None)

    async def broadcast(self, mission_id: str, message: dict) -> None:
        for ws in list(self.rooms.get(mission_id, ())):
            try:
                await ws.send_json(message)
            except Exception:
                # A dead socket — drop it so we don't keep trying.
                self.disconnect(mission_id, ws)


manager = ConnectionManager()


@router.websocket("/ws/missions/{mission_id}")
async def mission_socket(ws: WebSocket, mission_id: str) -> None:
    await manager.connect(mission_id, ws)
    try:
        # First frame: the full snapshot (closes the GET<->WS gap).
        try:
            async with AsyncSessionLocal() as db:
                state = await get_mission_state(db, mission_id)
        except Exception:
            await ws.send_json(ErrorMessage(message="mission not found").model_dump(mode="json"))
            await ws.close()
            manager.disconnect(mission_id, ws)
            return
        await ws.send_json(SnapshotMessage(state=state).model_dump(mode="json"))

        # Commands go over HTTP for the MVP, so we just read to detect the
        # client going away (and keep the connection open).
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(mission_id, ws)


async def ws_broadcaster() -> None:
    """Background task: forward every mission event to the right sockets.

    Unique group id per process so each API instance receives EVERY event for
    the missions its clients hold (a shared group would split partitions and an
    instance could miss events for one of its connections). `latest` offset —
    the snapshot on connect already covers history.
    """
    consumer = AIOKafkaConsumer(
        MISSION_EVENTS_TOPIC,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=f"ws-broadcaster-{uuid4()}",
        auto_offset_reset="latest",
    )
    await consumer.start()
    log.info("ws broadcaster consuming %s", MISSION_EVENTS_TOPIC)
    try:
        async for msg in consumer:
            event = deserialize(msg.value)
            message = MissionEventMessage(event=event).model_dump(mode="json")
            await manager.broadcast(event["mission_id"], message)
    except asyncio.CancelledError:
        pass  # normal on shutdown
    finally:
        await consumer.stop()
