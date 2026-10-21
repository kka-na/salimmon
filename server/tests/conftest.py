from __future__ import annotations

import shutil
from collections.abc import Callable
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import REPO_ROOT, Settings
from app.main import create_app

SAMPLES = REPO_ROOT / "samples" / "research"


@pytest.fixture
def research_dir(tmp_path: Path) -> Path:
    """A writable copy of the test-only sample dataset."""
    dst = tmp_path / "research"
    shutil.copytree(SAMPLES, dst)
    return dst


@pytest.fixture
def make_client(tmp_path: Path) -> Callable[..., TestClient]:
    db_url = f"sqlite:///{tmp_path / 'test.db'}"

    def _make(research: Path, **overrides) -> TestClient:
        settings = Settings(research_dir=research, database_url=db_url, cors_origins=[], **overrides)
        return TestClient(create_app(settings))

    return _make


@pytest.fixture
def client(research_dir: Path, make_client) -> TestClient:
    return make_client(research_dir)


def write_md(root: Path, rel: str, front: str, body: str = "# 본문\n") -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"---\n{front.strip()}\n---\n{body}", encoding="utf-8")
    return path
