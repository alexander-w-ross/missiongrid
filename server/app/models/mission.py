from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    # Import only for type-checkers; at runtime SQLAlchemy resolves these names
    # from the declarative registry, so importing here would be a circular import.
    from app.models.cell import MissionCell
    from app.models.fire import Fire
    from app.models.responder import Responder


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    name: Mapped[str] = mapped_column()
    width: Mapped[int] = mapped_column()
    height: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column()

    cells: Mapped[list["MissionCell"]] = relationship(back_populates="mission")
    fires: Mapped[list["Fire"]] = relationship(back_populates="mission")
    responders: Mapped[list["Responder"]] = relationship(back_populates="mission")
