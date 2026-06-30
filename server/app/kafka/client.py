from aiokafka import AIOKafkaProducer

from app.config import settings
from app.kafka.serialization import serialize
from app.kafka.topics import (
    MISSION_COMMANDS_TOPIC, MISSION_EVENTS_TOPIC, MISSION_DEAD_LETTER_TOPIC,
    RESPONDER_TELEMETRY_TOPIC,
)

_producer: AIOKafkaProducer | None = None


async def start_producer() -> None:
    global _producer
    _producer = AIOKafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        acks="all",                 # wait for the broker to durably ack
        enable_idempotence=True,    # no duplicate appends on producer retry
    )
    await _producer.start()      # MUST await before first send


async def stop_producer() -> None:
    if _producer:
        await _producer.stop()

async def publish(topic: str, key: str, value) -> None:
    # key is the mission_id string -> same mission stays on one partition and ordered
    if _producer is None: raise RuntimeError("producer not started")
    await _producer.send_and_wait(
        topic,
        value=serialize(value),
        key=key.encode("utf-8"),
    )
    
# thin helpers so callers don't repeat topic names
async def publish_command(mission_id: str, envelope):
    await publish(MISSION_COMMANDS_TOPIC, mission_id, envelope)

async def publish_event(mission_id: str, envelope):
    await publish(MISSION_EVENTS_TOPIC, mission_id, envelope)

async def publish_dead_letter(mission_id: str, envelope):
    await publish(MISSION_DEAD_LETTER_TOPIC, mission_id, envelope)

async def publish_telemetry(mission_id: str, envelope):
    await publish(RESPONDER_TELEMETRY_TOPIC, mission_id, envelope)