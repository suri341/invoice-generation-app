from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Local dev default: postgres running on the machine or Docker host.
    # For EKS + PostgreSQL StatefulSet, override this via env/secret:
    # DATABASE_URL=postgresql://postgres:postgres@postgres:5432/invoice_db
    DATABASE_URL: str = "postgresql://postgres:postgres@postgres:5432/invoice_db"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    CORS_ORIGINS: str = "https://invoice.vihan.store,https://backend.vihan.store,http://localhost:3000,http://localhost:5173"
    DEBUG: bool = True

    # Company Information
    APP_NAME: str = "Jagannath Enterprises Invoice System"
    COMPANY_NAME: str = "Jagannath Enterprises"
    OWNER_NAME: str = "K. Krishna"
    PHONE_NUMBER: str = "8919575870"
    COMPANY_ADDRESS: str = "Rice Mill Parts Supplier"
    GSTIN: str = ""  # Add GST number if available

    # Tax Configuration
    CGST_RATE: float = 9.0  # Central GST
    SGST_RATE: float = 9.0  # State GST
    IGST_RATE: float = 18.0  # Integrated GST

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
