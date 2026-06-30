"""Telemetry worker: consume responder.telemetry.v1, reconcile to official events.

Group ``telemetry-workers``. Each uploaded backlog (flushed by the simulation
worker when a responder reconnects) becomes RESPONDER_RECONNECTED +
RESPONDER_POSITION_RECONCILED on mission.events.v1, which the projector applies
so central state catches up.
"""

import asyncio
import logging

from aiokafka import AIOKafkaConsumer

from app.config import settings
from app.db.session import AsyncSessionLocal
from app.kafka.client import publish_event, start_producer, stop_producer
from app.kafka.serialization import deserialize
from app.kafka.topics import RESPONDER_TELEMETRY_TOPIC
from app.services.idempotency import already_processed, mark_processed
from app.services.reconciliation_service import build_reconciliation_events

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("telemetry")

GROUP = "telemetry-workers"


async def run() -> None:
    await start_producer()
    consumer = AIOKafkaConsumer(
        RESPONDER_TELEMETRY_TOPIC,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=GROUP,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )
    await consumer.start()
    log.info("telemetry worker consuming %s", RESPONDER_TELEMETRY_TOPIC)
    try:
        async for msg in consumer:
            telemetry = deserialize(msg.value)
            async with AsyncSessionLocal() as db:
                if not await already_processed(db, telemetry["id"], GROUP):
                    for event in build_reconciliation_events(telemetry):
                        await publish_event(telemetry["mission_id"], event)
                    await mark_processed(db, telemetry["id"], GROUP)
                    await db.commit()
                    log.info("reconciled responder %s (%d buffered move(s))",
                             telemetry["responder_id"], len(telemetry.get("backlog", [])))
            await consumer.commit()
    finally:
        await consumer.stop()
        await stop_producer()


if __name__ == "__main__":
    asyncio.run(run())
