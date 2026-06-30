from datetime import datetime
from uuid import UUID
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


if TYPE_CHECKING:
    # Import only for type-checkers; at runtime SQLAlchemy resolves these names
    # from the declarative registry, so importing here would be a circular import.
    from app.models.mission import Mission
    from app.models.fire import Fire


class Responder(Base):
    __tablename__ = "responders"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    name: Mapped[str] = mapped_column()

    # live position
    x: Mapped[int] = mapped_column()
    y: Mapped[int] = mapped_column()

    # last position mission control actually saw (frozen while signal is blocked)
    last_known_x: Mapped[int] = mapped_column()
    last_known_y: Mapped[int] = mapped_column()

    status: Mapped[str] = mapped_column()  # idle/moving/fighting_fire/returning/disconnected
    signal_status: Mapped[str] = mapped_column()  # connected/blocked/reconnecting
    path_json: Mapped[list | None] = mapped_column(JSONB)  # [{x, y}, ...]
    path_index: Mapped[int] = mapped_column(server_default="0")

    mission_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("missions.id"), nullable=False
    )
    mission: Mapped["Mission"] = relationship(back_populates="responders")

    assigned_fire_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("fires.id")
    )
    
    fire: Mapped["Fire | None"] = relationship()

    __table_args__ = (
        Index("ix_responder_mission_id", "mission_id"),
    )
