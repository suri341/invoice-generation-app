from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database with tables"""
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_quotation_id INTEGER"
            ))
            connection.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_source_quotation'
                    ) THEN
                        ALTER TABLE invoices
                        ADD CONSTRAINT fk_invoices_source_quotation
                        FOREIGN KEY (source_quotation_id) REFERENCES invoices(id);
                    END IF;
                END $$;
            """))
