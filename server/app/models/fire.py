from datetime import datetime
from uuid import UUID
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


if TYPE_CHECKING:
    # Import only for type-checkers; at runtime SQLAlchemy resolves these names
    # from the declarative registry, so importing here would be a circular import.
    from app.models.mission import Mission



class Fire(Base):
    __tablename__ = "fires"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    x: Mapped[int] = mapped_column()
    y: Mapped[int] = mapped_column()
    intensity: Mapped[int] = mapped_column(server_default="100")
    status: Mapped[str] = mapped_column()  # active / contained / extinguished
    extinguished_at: Mapped[datetime | None] = mapped_column()

    mission_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("missions.id"), nullable=False
    )

    mission: Mapped["Mission"] = relationship(back_populates="fires")

    # FK columns are NOT auto-indexed in Postgres; index it for the per-mission
    # queries. (trailing comma makes this a 1-tuple)
    __table_args__ = (
        Index("ix_fire_mission_id", "mission_id"),
    )
