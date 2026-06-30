import uuid
from datetime import datetime, timezone

from app.kafka.client import publish_command
from app.schemas.commands import CommandEnvelope
from app.schemas.common import CommandType

async def send_command(type_: CommandType, mission_id: str, payload: dict) -> CommandEnvelope:
    env = CommandEnvelope(
        id=f"cmd_{uuid.uuid4()}",
        type=type_,
        mission_id=mission_id,
        correlation_id=f"corr_{uuid.uuid4()}",
        created_at=datetime.now(timezone.utc),
        payload=payload,
    )
    await publish_command(mission_id, env)
    return env