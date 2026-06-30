"""Projector worker: consume mission.events.v1, apply each to Postgres.

Group ``state-projectors``. At-least-once + idempotent: the read-model write and
the processed-messages insert commit in ONE transaction, then the Kafka offset
is committed. A redelivery after the DB commit but before the offset commit hits
``already_processed`` and safely skips.
"""

import asyncio
import logging

from aiokafka import AIOKafkaConsumer

from app.config import settings
from app.db.session import AsyncSessionLocal
from app.kafka.serialization import deserialize
from app.kafka.topics import MISSION_EVENTS_TOPIC
from app.services.idempotency import already_processed, mark_processed
from app.services.projection_service import apply_event

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("projector")

GROUP = "state-projectors"


async def run() -> None:
    consumer = AIOKafkaConsumer(
        MISSION_EVENTS_TOPIC,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=GROUP,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )
    await consumer.start()
    log.info("projector consuming %s", MISSION_EVENTS_TOPIC)
    try:
        async for msg in consumer:
            event = deserialize(msg.value)
            async with AsyncSessionLocal() as db:
                if not await already_processed(db, event["id"], GROUP):
                    await apply_event(db, event)
                    await mark_processed(db, event["id"], GROUP)
                    await db.commit()  # state + dedup row in one txn
                    log.info("applied %s for mission %s", event["type"], event["mission_id"])
            await consumer.commit()  # advance offset only after the txn
    finally:
        await consumer.stop()


if __name__ == "__main__":
    asyncio.run(run())
