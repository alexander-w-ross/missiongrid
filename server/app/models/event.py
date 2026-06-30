from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MissionEvent(Base):
    """Append-only log of official mission events (immutable -> no updated_at)."""

    __tablename__ = "mission_events"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    type: Mapped[str] = mapped_column()
    payload: Mapped[dict] = mapped_column(JSONB)
    correlation_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    causation_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    occurred_at: Mapped[datetime] = mapped_column(server_default=func.now())

    mission_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("missions.id"), nullable=False
    )

    # recent-events query: WHERE mission_id = ? ORDER BY occurred_at DESC
    __table_args__ = (
        Index("ix_mission_event_mission_id", "mission_id"),
    )


class ProcessedMessage(Base):
    """Idempotency ledger: a consumer marks each message id it has handled."""

    __tablename__ = "processed_messages"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    processed_at: Mapped[datetime] = mapped_column(server_default=func.now())

    message_id: Mapped[str] = mapped_column()  # the envelope id we've seen
    consumer_name: Mapped[str] = mapped_column()  # e.g. state-projectors

    __table_args__ = (
        UniqueConstraint("message_id", name="uq_processed_message"),
    )
