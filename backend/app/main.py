"""Main FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.api.v1 import router as api_router
from app.database import init_db, engine
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Schedule Designer API",
        description="Backend for Automated Timetable Generator Using Graph Coloring Algorithm",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS - configure origins appropriately in production
    origins = ["*"] if settings.DEBUG else (settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routers
    app.include_router(auth_router, prefix="/api/auth")
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/health", include_in_schema=False)
    async def health():
        return {"status": "ok", "service": "schedule-designer"}

    return app

app = create_app()