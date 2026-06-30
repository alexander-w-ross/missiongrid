from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for all ORM models.

    Alembic autogenerate diffs ``Base.metadata`` against the live database. For
    a model to show up, it must be imported before autogenerate runs. The
    convention here: define each model under ``app/models/`` and re-export it
    from ``app/models/__init__.py``; ``alembic/env.py`` imports that package.
    """
