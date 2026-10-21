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


def test_find_og_image():
    sys.path.insert(0, str(SCRIPT.parent))
    from import_research import find_og_image

    page = '<head><meta content="/img/a.jpg" property="og:image"><meta name="twitter:image" content="https://x.com/t.jpg"></head>'
    assert find_og_image(page, "https://brand.example/p/1") == "https://brand.example/img/a.jpg"
    assert find_og_image('<meta name="twitter:image" content="https://x.com/t.jpg">', "https://b/") == "https://x.com/t.jpg"
    assert find_og_image("<html></html>", "https://b/") is None


def test_requests_md_flags_shared_image_pages(research_dir: Path):
    for mid in ("sample-pogeun-wood", "sample-pogeun-storage"):
        path = research_dir / "models" / f"{mid}.md"
        path.write_text(path.read_text(encoding="utf-8").replace(
            "specs:", "image:\n  image_source_url: https://example.com/list\nspecs:", 1), encoding="utf-8")
    assert "전용 공식 상품 페이지가 아님" in build_requests_md(load_research(research_dir))


def test_page_product_images_prefers_unique_large_variant():
    sys.path.insert(0, str(SCRIPT.parent))
    from import_research import pick_page_image, page_product_images

    page = (
        '<img src="/img/banner.jpg"><img src="https://cdn.x/products/1/a.jpg?w=68&amp;f=webp">'
        '<img src="https://cdn.x/products/1/a.jpg?w=960&amp;f=webp"><img data-src="//cdn.x/product/sub/og1.jpg">'
        '<img src="https://cdn.x/products/common/badge.png">'
    )
    found = page_product_images(page, "https://shop.x/view/1")
    assert found == ["https://cdn.x/products/1/a.jpg?w=960&f=webp", "https://cdn.x/product/sub/og1.jpg", "https://cdn.x/products/common/badge.png"]
    picked = pick_page_image(found, {"https://cdn.x/products/common/badge.png"}, "og1.jpg")
    assert picked == ["https://cdn.x/product/sub/og1.jpg", "https://cdn.x/products/1/a.jpg?w=960&f=webp"]
