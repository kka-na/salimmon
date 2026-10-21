from __future__ import annotations

from pathlib import Path

import pytest

from app.config import REPO_ROOT
from app.research.loader import load_research

from .conftest import SAMPLES, write_md


def issues_for(data, rel: str):
    return [i for i in data.issues if i.path == rel]


def test_samples_load_without_errors():
    data = load_research(SAMPLES)
    assert data.report()["summary"]["error"] == 0
    assert data.counts == {"category": 2, "brand": 3, "model": 5, "store": 3, "review": 4}
    assert data.has_sample_data


@pytest.mark.skipif(not any((REPO_ROOT / "research").rglob("models/*.md")), reason="no real research data")
def test_real_research_dir_has_no_errors():
    data = load_research(REPO_ROOT / "research")
    errors = [i.as_dict() for i in data.issues if i.severity == "error"]
    assert errors == []


def test_missing_frontmatter_is_reported(research_dir: Path):
    (research_dir / "models" / "broken.md").write_text("# no frontmatter\n", encoding="utf-8")
    data = load_research(research_dir)
    [issue] = issues_for(data, "models/broken.md")
    assert issue.severity == "error" and issue.field == "frontmatter"


def test_invalid_fields_report_path_and_field(research_dir: Path):
    write_md(research_dir, "models/bad-price.md", """
schema_version: 1
entity_type: model
id: bad-price
category_id: beds
brand_id: sample-malang
name: 잘못된 가격
product_kind: mattress
updated_at: 2026-10-21
status: researching
prices:
  - amount_krw: "549,000원"
    size_or_option: Q
    price_kind: official_list
    observed_at: 2026-10-01
    source_url: https://example.com/x
  - amount_krw: 100
    size_or_option: Q
    price_kind: guessed
    observed_at: 2026-10-01
    source_url: null
""")
    data = load_research(research_dir)
    fields = {i.field for i in issues_for(data, "models/bad-price.md")}
    assert {"prices.0.amount_krw", "prices.1.price_kind", "prices.1.source_url"} <= fields
    assert "bad-price" not in data.models


def test_unknown_entity_type_and_duplicate_id(research_dir: Path):
    write_md(research_dir, "models/x.md", "schema_version: 1\nentity_type: gadget\nid: x\nupdated_at: 2026-10-21\nstatus: researching")
    dup = (research_dir / "brands" / "sample-malang.md").read_text(encoding="utf-8")
    (research_dir / "brands" / "copy.md").write_text(dup, encoding="utf-8")
    data = load_research(research_dir)
    assert issues_for(data, "models/x.md")[0].field == "entity_type"
    # Files are read in path order; the later file with the same id is rejected.
    assert any(i.field == "id" and i.severity == "error" for i in issues_for(data, "brands/sample-malang.md"))
    assert len(data.brands) == 3


def test_store_coordinates_must_be_paired(research_dir: Path):
    write_md(research_dir, "stores/half.md", """
schema_version: 1
entity_type: store
id: half
name: 반쪽 좌표
lat: 37.5
lng: null
updated_at: 2026-10-21
status: researching
""")
    data = load_research(research_dir)
    assert issues_for(data, "stores/half.md")[0].severity == "error"


def test_model_with_unknown_category_is_excluded_with_error(research_dir: Path):
    write_md(research_dir, "models/orphan.md", """
schema_version: 1
entity_type: model
id: orphan
category_id: no-such-category
brand_id: sample-malang
name: 고아 모델
product_kind: etc
updated_at: 2026-10-21
status: researching
""")
    data = load_research(research_dir)
    assert "orphan" not in data.models
    assert any(i.field == "category_id" and i.severity == "error" for i in issues_for(data, "models/orphan.md"))


def test_display_list_without_verified_status_warns(research_dir: Path):
    path = research_dir / "stores" / "sample-store-suwon.md"
    path.write_text(path.read_text(encoding="utf-8").replace("model_ids_on_display: []", "model_ids_on_display: [sample-pogeun-wood]"), encoding="utf-8")
    data = load_research(research_dir)
    assert any(i.field == "display_status" and i.severity == "warning" for i in issues_for(data, "stores/sample-store-suwon.md"))


def test_underscore_and_readme_files_are_ignored(research_dir: Path):
    write_md(research_dir, "_templates/model.md", "entity_type: model")
    data = load_research(research_dir)
    assert not any(i.path.startswith("_templates") for i in data.issues)
