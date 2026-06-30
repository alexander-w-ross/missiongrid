"""Simulation worker: consume mission.commands.v1 AND run the tick loop.

Group ``simulation-workers``. Two concurrent tasks share the in-memory world:
the consumer turns commands into events, the tick loop advances the world every
TICK_INTERVAL_MS. Both publish to mission.events.v1. Commands are idempotent on
their id so a redelivery doesn't re-emit; failed commands go to the dead letter
topic.
"""

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from aiokafka import AIOKafkaConsumer

from app.config import settings
from app.db.session import AsyncSessionLocal
from app.kafka.client import (
    publish_dead_letter,
    publish_event,
    publish_telemetry,
    start_producer,
    stop_producer,
)
from app.kafka.serialization import deserialize
from app.kafka.topics import MISSION_COMMANDS_TOPIC
from app.models import ResponderLocalOutbox
from app.schemas.common import SignalStatus
from app.services import simulation_service
from app.services.idempotency import already_processed, mark_processed

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("simulation")

GROUP = "simulation-workers"


async def run() -> None:
    await start_producer()
    world = await simulation_service.rehydrate()
    log.info("rehydrated %d mission(s)", len(world))

    consumer = AIOKafkaConsumer(
        MISSION_COMMANDS_TOPIC,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=GROUP,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )
    await consumer.start()
    log.info("simulation worker consuming %s", MISSION_COMMANDS_TOPIC)
    try:
        await asyncio.gather(_consume(consumer, world), _tick(world))
    finally:
        await consumer.stop()
        await stop_producer()


async def _consume(consumer: AIOKafkaConsumer, world) -> None:
    async for msg in consumer:
        cmd = deserialize(msg.value)
        mission_id = cmd["mission_id"]
        try:
            async with AsyncSessionLocal() as db:
                if await already_processed(db, cmd["id"], GROUP):
                    await consumer.commit()
                    continue

            events = simulation_service.handle_command(cmd, world)
            for event in events:
                await publish_event(mission_id, event)

            async with AsyncSessionLocal() as db:
                await mark_processed(db, cmd["id"], GROUP)
                await db.commit()
            log.info("handled %s -> %d event(s)", cmd["type"], len(events))
        except Exception:
            log.exception("command failed, dead-lettering: %s", cmd.get("type"))
            await publish_dead_letter(mission_id, cmd)
        await consumer.commit()


async def _tick(world) -> None:
    interval = settings.TICK_INTERVAL_MS / 1000
    while True:
        await asyncio.sleep(interval)
        for mission_id in list(world.keys()):
            try:
                events = simulation_service.run_tick(mission_id, world)
            except Exception:
                log.exception("tick failed for mission %s", mission_id)
                continue
            for event in events:
                await publish_event(mission_id, event)
            await _flush_reconnected(world[mission_id])


async def _flush_reconnected(mission) -> None:
    """For each responder that reconnected this tick (connected with a buffered
    backlog), persist the backlog to responder_local_outbox and upload it to
    responder.telemetry.v1, then stamp flushed_at."""
    for r in mission.responders.values():
        if r.signal_status != SignalStatus.CONNECTED or not r.local_log:
            continue
        backlog = r.local_log
        r.local_log = []
        try:
            async with AsyncSessionLocal() as db:
                rows = [
                    ResponderLocalOutbox(
                        mission_id=UUID(mission.mission_id), responder_id=UUID(r.id),
                        event_type="LOCAL_MOVE", payload=entry,
                    )
                    for entry in backlog
                ]
                for row in rows:
                    db.add(row)
                await db.flush()
                await publish_telemetry(mission.mission_id, {
                    "id": str(uuid4()),
                    "type": "RESPONDER_TELEMETRY_UPLOADED",
                    "mission_id": mission.mission_id,
                    "responder_id": r.id,
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                    "final_position": {"x": r.x, "y": r.y},
                    "backlog": backlog,
                })
                stamped = datetime.now(timezone.utc).replace(tzinfo=None)
                for row in rows:
                    row.flushed_at = stamped
                await db.commit()
            log.info("flushed %d buffered move(s) for responder %s", len(backlog), r.id)
        except Exception:
            log.exception("telemetry flush failed for responder %s", r.id)
            r.local_log = backlog + r.local_log  # re-buffer, retry next tick


if __name__ == "__main__":
    asyncio.run(run())
