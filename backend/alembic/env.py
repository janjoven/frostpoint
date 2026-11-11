from alembic import context

from app.config import settings
from app.db import Base, engine
from app import models  # noqa: F401  (register tables)

config = context.config
target_metadata = Base.metadata


def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        connection.commit()


run_migrations_online()
