"""Database session management (sync + async)."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings

# Sync engine - used for seeding, migrations, and direct DB calls
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(settings.DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
else:
    engine = create_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async engine - used by FastAPI
async_url = settings.DATABASE_URL
if async_url.startswith("sqlite"):
    async_url = async_url.replace("sqlite:///", "sqlite+aiosqlite:///")
elif async_url.startswith("postgresql"):
    async_url = async_url.replace("postgresql://", "postgresql+asyncpg://")

async_engine = create_async_engine(async_url, echo=False)
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine, class_=AsyncSession, expire_on_commit=False
)


def get_db():
    """Sync DB session dependency (for FastAPI)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db():
    """Async DB session dependency."""
    async with AsyncSessionLocal() as session:
        yield session


def init_db():
    """Create all tables."""
    from app.models.base import Base
    Base.metadata.create_all(bind=engine)


def drop_db():
    """Drop all tables."""
    from app.models.base import Base
    Base.metadata.drop_all(bind=engine)