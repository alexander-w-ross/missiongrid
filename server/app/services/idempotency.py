"""Idempotency ledger helpers.

Kafka gives at-least-once delivery, so a worker can see the same message twice
(crash before commit, rebalance). Before handling a message a consumer checks
``already_processed``; after handling it inserts a row with ``mark_processed``.
The unique constraint on ``processed_messages.message_id`` is the backstop.

Command ids and event ids live in disjoint id-spaces, so a single unique index
on ``message_id`` is enough to dedup both the simulation worker (commands) and
the projector (events).
"""

from sqlalchemy import select

from app.models import ProcessedMessage


async def already_processed(db, message_id: str, consumer_name: str) -> bool:
    result = await db.scalars(
        select(ProcessedMessage).where(ProcessedMessage.message_id == message_id)
    )
    return result.first() is not None


async def mark_processed(db, message_id: str, consumer_name: str) -> None:
    db.add(ProcessedMessage(message_id=message_id, consumer_name=consumer_name))
