from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ResponderLocalOutbox(Base):
    """A disconnected responder's local backlog

    While ``signal_status == "blocked"`` the responder can't reach mission
    control, so it buffers its own movement / fire-observation events here.
    On signal restore the backlog is flushed to ``responder.telemetry.v1`` and
    ``flushed_at`` is stamped; the telemetry worker then reconciles official
    state. ``flushed_at IS NULL`` means "not yet uploaded".
    """

    __tablename__ = "responder_local_outbox"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    mission_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("missions.id"), nullable=False
    )
    responder_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("responders.id"), nullable=False
    )

    event_type: Mapped[str] = mapped_column()
    payload: Mapped[dict] = mapped_column(JSONB)
    occurred_at: Mapped[datetime] = mapped_column(server_default=func.now())
    flushed_at: Mapped[datetime | None] = mapped_column()  # NULL until uploaded

    # Flush queries scan a responder's un-flushed rows in order.
    __table_args__ = (
        Index("ix_responder_local_outbox_responder_id", "responder_id"),
    )


class PendingResponderCommand(Base):
    """A command queued for a currently-disconnected responder.

    Mission control can't deliver to a blocked responder, so the command waits
    here; on reconnect it's delivered and ``delivered_at`` is stamped.
    ``delivered_at IS NULL`` means "still pending".
    """

    __tablename__ = "pending_responder_commands"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    mission_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("missions.id"), nullable=False
    )
    responder_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("responders.id"), nullable=False
    )

    command_type: Mapped[str] = mapped_column()
    payload: Mapped[dict] = mapped_column(JSONB)
    delivered_at: Mapped[datetime | None] = mapped_column()  # NULL until delivered
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("ix_pending_responder_commands_responder_id", "responder_id"),
    )
