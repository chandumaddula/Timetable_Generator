"""Database session management (sync + async)."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings

# Helpers for URL normalization
def get_sync_database_url(url: str) -> str:
    """Normalize database URL for synchronous SQLAlchemy engine."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def get_async_database_url(url: str) -> str:
    """Normalize database URL for asynchronous SQLAlchemy engine."""
    sync_url = get_sync_database_url(url)
    if sync_url.startswith("sqlite:///"):
        return sync_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    elif sync_url.startswith("sqlite://"):
        return sync_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    elif sync_url.startswith("postgresql://"):
        return sync_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return sync_url


sync_db_url = get_sync_database_url(settings.DATABASE_URL)
async_db_url = get_async_database_url(settings.DATABASE_URL)

# Sync engine - used for seeding, migrations, and direct DB calls
if sync_db_url.startswith("sqlite"):
    engine = create_engine(sync_db_url, echo=False, connect_args={"check_same_thread": False})
else:
    engine = create_engine(sync_db_url, echo=False, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async engine - used by FastAPI
async_engine = create_async_engine(async_db_url, echo=False)
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

    # Bootstrap roles, admin user, and initial dataset if fresh database
    try:
        from app.models.base import User, Role, UserRole, Department
        from app.security import hash_password
        import os

        with SessionLocal() as db:
            # 1. Seed default roles if missing
            if db.query(Role).count() == 0:
                admin_role = Role(name="admin", description="System administrator")
                faculty_role = Role(name="faculty", description="Faculty member")
                student_role = Role(name="student", description="Student")
                db.add_all([admin_role, faculty_role, student_role])
                db.commit()

            # 2. Seed default admin user if none exists
            if db.query(User).count() == 0:
                admin_role = db.query(Role).filter(Role.name == "admin").first()
                admin_user = User(
                    username="admin",
                    email="admin@timetable.app",
                    full_name="Administrator",
                    hashed_password=hash_password("admin123"),
                    is_active=True,
                    is_superuser=True,
                )
                db.add(admin_user)
                db.commit()
                db.refresh(admin_user)
                if admin_role:
                    db.add(UserRole(user_id=admin_user.id, role_id=admin_role.id))
                    db.commit()

            # 3. Seed initial excel dataset if department table is completely empty
            if db.query(Department).count() == 0:
                candidate_paths = [
                    os.path.join(os.path.dirname(__file__), "..", "data", "timetable.xlsx"),
                    os.path.join(os.getcwd(), "data", "timetable.xlsx"),
                    os.path.join(os.getcwd(), "backend", "data", "timetable.xlsx"),
                ]
                for p in candidate_paths:
                    if os.path.exists(p):
                        try:
                            from scripts.import_excel import import_timetable_from_excel
                            import_timetable_from_excel(p, db)
                            break
                        except Exception:
                            pass
    except Exception:
        pass


def drop_db():
    """Drop all tables."""
    from app.models.base import Base
    Base.metadata.drop_all(bind=engine)