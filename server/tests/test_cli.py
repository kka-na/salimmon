from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from app.research.loader import load_research
from app.research.requests import build_requests_md

from .conftest import write_md

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "import_research.py"


def run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True)


def test_cli_ok_and_error_exit_codes(research_dir: Path):
    assert run("--research-dir", str(research_dir)).returncode == 0
    write_md(research_dir, "reviews/bad.md", "schema_version: 2\nentity_type: review\nid: bad\nupdated_at: 2026-10-21\nstatus: researching\ncategory_id: beds")
    result = run("--research-dir", str(research_dir))
    assert result.returncode == 1
    assert "reviews/bad.md" in result.stdout and "schema_version" in result.stdout


def test_requests_md_lists_gaps(research_dir: Path):
    md = build_requests_md(load_research(research_dir))
    assert "말랑 하이브리드 매트리스" in md and "가격 기록 없음" in md
    assert "위치 미확인 매장" in md
