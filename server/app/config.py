from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, loaded from environment / .env.

    Defaults match the docker-compose service hostnames so the containers work
    without a .env present, but .env (or real env vars) override them.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = (
        "postgresql+asyncpg://missiongrid:missiongrid@postgres:5432/missiongrid"
    )

    KAFKA_BOOTSTRAP_SERVERS: str = "redpanda:9092"
    KAFKA_COMMANDS_TOPIC: str = "mission.commands.v1"
    KAFKA_EVENTS_TOPIC: str = "mission.events.v1"
    KAFKA_TELEMETRY_TOPIC: str = "responder.telemetry.v1"
    KAFKA_DEAD_LETTER_TOPIC: str = "mission.dead_letter.v1"

    # Comma-separated list of allowed browser origins for CORS.
    CORS_ORIGINS: str = "http://localhost:3000"

    TICK_INTERVAL_MS: int = 500

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
