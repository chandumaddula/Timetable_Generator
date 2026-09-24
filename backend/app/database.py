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
    """Create all tables and safely apply column additions if SQLite."""
    from app.models.base import Base
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)

    # Automatically add new columns if upgrading existing SQLite database
    if settings.DATABASE_URL.startswith("sqlite"):
        try:
            with engine.connect() as conn:
                def add_col_if_missing(table, col_name, col_def):
                    try:
                        res = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
                        cols = [r[1] for r in res]
                        if cols and col_name not in cols:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
                            conn.commit()
                    except Exception:
                        pass

                add_col_if_missing("faculty", "department_id", "INTEGER")
                add_col_if_missing("faculty", "initials", "VARCHAR(20)")
                add_col_if_missing("courses", "department_id", "INTEGER")
                add_col_if_missing("courses", "semester", "VARCHAR(50)")
                add_col_if_missing("rooms", "department_id", "INTEGER")

                # Remove unique index on courses.code so course codes can be shared across departments/semesters
                try:
                    conn.execute(text("DROP INDEX IF EXISTS ix_courses_code"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_courses_code ON courses (code)"))
                    conn.commit()
                except Exception:
                    pass
        except Exception:
            pass


def drop_db():
    """Drop all tables."""
    from app.models.base import Base
    Base.metadata.drop_all(bind=engine)