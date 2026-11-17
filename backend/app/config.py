from pydantic import SecretStr
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
    # Backend-only credentials for the AML ERP integration; never expose through VITE_*.
    erp_base_url: str = ""
    erp_api_key: SecretStr = SecretStr("")
    erp_api_secret: SecretStr = SecretStr("")
    erp_requisition_prefix: str = "FRP-"
    erp_requisition_writes_enabled: bool = False
    erp_requisition_create_enabled: bool = False
    erp_dpo_create_enabled: bool = False


settings = Settings()
