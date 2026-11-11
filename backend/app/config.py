from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://frostpoint:frostpoint@db:5432/frostpoint"
    jwt_secret: str = "change-me-in-env"
    access_minutes: int = 30
    refresh_days: int = 14
    cookie_secure: bool = False
    proofs_dir: str = "/data/proofs"
    seed_admin_email: str = "admin@frostpoint.ph"
    seed_admin_password: str = "Frostpoint123!"
    seed_demo: bool = True
    # Free key from openrouteservice.org. Without one, tracking falls back to a straight line and a rough ETA.
    ors_api_key: str = ""


settings = Settings()
