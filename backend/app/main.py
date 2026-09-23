"""Main FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.api.v1 import router as api_router
from app.database import init_db, get_db, get_async_db, AsyncSessionLocal, engine
from app.config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Schedule Designer API",
        description="Backend for Automated Timetable Generator Using Graph Coloring Algorithm",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS - configure origins appropriately in production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.DEBUG else ["http://localhost:3000"],
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

    @app.on_event("startup")
    async def on_startup():
        init_db()

    @app.on_event("shutdown")
    async def on_shutdown():
        engine.dispose()

    return app

app = create_app()