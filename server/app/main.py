"""FastAPI entry point: `uvicorn app.main:app --reload` from server/."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import catalog, personal
from .config import Settings, load_settings
from .state import AppState

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    state = AppState(settings)

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        task = asyncio.create_task(state.watch()) if settings.watch_research else None
        yield
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title="salimmon API", version="1.0.0", lifespan=lifespan)
    app.state.salimmon = state
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "PUT", "POST"],
        allow_headers=["*"],
    )
    app.include_router(catalog.router)
    app.include_router(personal.router)

    # Images referenced as /assets/... in the MD are served from research/assets/.
    assets = settings.research_dir / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")
    return app


def __getattr__(name: str) -> FastAPI:
    # Built lazily so tests can import create_app without touching the default database.
    if name == "app":
        globals()["app"] = instance = create_app()
        return instance
    raise AttributeError(name)
