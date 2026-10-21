"""Runtime settings, read from environment variables (and an optional server/.env file)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVER_DIR.parent


def _load_dotenv(path: Path) -> None:
    """Minimal .env reader: KEY=VALUE lines, never overrides real environment variables."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _resolve(path_value: str) -> Path:
    path = Path(path_value).expanduser()
    # Relative paths are resolved against the repository root so the same value
    # works no matter which directory uvicorn / the CLI is started from.
    return path if path.is_absolute() else (REPO_ROOT / path).resolve()


def _resolve_db_url(url: str) -> str:
    # sqlite:///relative/path.db → resolve like RESEARCH_DIR (repo root), absolute paths untouched.
    prefix = "sqlite:///"
    if url.startswith(prefix) and not url.startswith(prefix + "/") and url != prefix + ":memory:":
        return prefix + str(_resolve(url[len(prefix):]))
    return url


@dataclass(frozen=True)
class Settings:
    research_dir: Path
    database_url: str
    cors_origins: list[str] = field(default_factory=list)
    watch_research: bool = False
    stale_price_days: int = 180
    enable_admin: bool = True
    official_image_preview: bool = False


def load_settings() -> Settings:
    _load_dotenv(SERVER_DIR / ".env")
    default_db = f"sqlite:///{SERVER_DIR / 'data' / 'salimmon.db'}"
    origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return Settings(
        research_dir=_resolve(os.environ.get("RESEARCH_DIR", "research")),
        database_url=_resolve_db_url(os.environ.get("DATABASE_URL", default_db)),
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        watch_research=_bool(os.environ.get("RESEARCH_WATCH"), False),
        stale_price_days=int(os.environ.get("STALE_PRICE_DAYS", "180")),
        enable_admin=_bool(os.environ.get("ENABLE_ADMIN"), True),
        official_image_preview=_bool(os.environ.get("OFFICIAL_IMAGE_PREVIEW"), False),
    )
