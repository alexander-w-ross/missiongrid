from datetime import datetime
from uuid import UUID
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


if TYPE_CHECKING:
    # Import only for type-checkers; at runtime SQLAlchemy resolves these names
    # from the declarative registry, so importing here would be a circular import.
    from app.models.mission import Mission

class MissionCell(Base):
    __tablename__ = "mission_cells"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    x: Mapped[int] = mapped_column()
    y: Mapped[int] = mapped_column()
    terrain: Mapped[str] = mapped_column()  # empty / mountain

    mission_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("missions.id"), nullable=False
    )

    mission: Mapped["Mission"] = relationship(back_populates="cells")


    __table_args__ = (
        UniqueConstraint("mission_id", "x", "y", name="uq_mission_cell"),
    )
