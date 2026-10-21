from __future__ import annotations

from pathlib import Path

from .conftest import write_md


def test_health_and_categories(client):
    health = client.get("/api/health").json()
    assert health["research"]["has_sample_data"] is True
    cats = client.get("/api/categories").json()
    assert [c["id"] for c in cats] == ["beds", "refrigerator"]
    beds = cats[0]
    assert beds["counts"]["models"] == 4
    assert beds["product_kinds"] == ["bed_frame", "mattress"]


def test_new_category_md_appears_without_code_change(client, research_dir: Path):
    write_md(research_dir, "categories/sofa.md", """
schema_version: 1
entity_type: category
id: sofa
name: 소파
emoji: "🛋️"
updated_at: 2026-10-21
status: researching
sort_order: 30
""")
    write_md(research_dir, "models/test-sofa.md", """
schema_version: 1
entity_type: model
id: test-sofa
category_id: sofa
brand_id: sample-pogeun
name: 테스트 소파
product_kind: furniture
updated_at: 2026-10-21
status: researching
""")
    assert "sofa" not in [c["id"] for c in client.get("/api/categories").json()]
    report = client.post("/api/admin/reload").json()
    assert report["summary"]["error"] == 0
    cats = {c["id"]: c for c in client.get("/api/categories").json()}
    assert cats["sofa"]["counts"]["models"] == 1
    items = client.get("/api/models", params={"category_id": "sofa"}).json()["items"]
    assert [m["id"] for m in items] == ["test-sofa"]
    assert items[0]["representative_price"] is None


def test_model_filters_and_search(client):
    def ids(**params):
        return {m["id"] for m in client.get("/api/models", params=params).json()["items"]}

    assert ids(category_id="beds", product_kind="bed_frame") == {"sample-pogeun-wood", "sample-pogeun-storage"}
    assert ids(brand_id="sample-malang") == {"sample-malang-pocket", "sample-malang-hybrid"}
    assert ids(q="수납") == {"sample-pogeun-storage"}
    assert ids(q="sample malang") == {"sample-malang-pocket", "sample-malang-hybrid"}
    # Models without a price never match a price filter.
    assert ids(category_id="beds", price_max=700000) == {"sample-pogeun-wood", "sample-pogeun-storage"}


def test_representative_price_and_freshness(client):
    items = {m["id"]: m for m in client.get("/api/models").json()["items"]}
    rep = items["sample-malang-pocket"]["representative_price"]
    assert (rep["amount_krw"], rep["size_or_option"], rep["price_kind"]) == (890000, "Q", "official_sale")
    assert items["sample-pogeun-wood"]["representative_price"]["freshness"] == "stale"
    assert items["sample-malang-hybrid"]["representative_price"] is None

    detail = client.get("/api/models/sample-malang-pocket").json()
    options = {g["size_or_option"]: g["records"] for g in detail["price_table"]}
    assert set(options) == {"Q", "K"}  # sizes are never merged
    assert any(r["freshness"] == "historical" for r in options["Q"])


def test_review_independence(client):
    detail = client.get("/api/models/sample-malang-pocket").json()
    by_id = {r["id"]: r for r in detail["reviews"]}
    assert by_id["review-sample-0001"]["is_independent"]
    assert by_id["review-sample-0002"]["exclusion_reasons"] == ["sponsored"]
    assert set(by_id["review-sample-0003"]["exclusion_reasons"]) == {"no_posted_at", "no_use_or_purchase_claim"}
    assert detail["review_stats"] == {
        "total": 4, "independent": 2, "excluded": 2, "positive": 1, "negative": 1, "mixed": 0, "purchase_proof": 1,
    }

    listed = client.get("/api/reviews", params={"model_id": "sample-malang-pocket"}).json()
    assert {r["id"] for r in listed["items"]} == {"review-sample-0001", "review-sample-0004"}
    all_ = client.get("/api/reviews", params={"model_id": "sample-malang-pocket", "include_excluded": True}).json()
    assert len(all_["items"]) == 4


def test_store_display_vs_store_only(client):
    detail = client.get("/api/models/sample-malang-pocket").json()
    rel = {s["id"]: s["relation"] for s in detail["stores"]}
    assert rel == {"sample-store-gangnam": "display_verified", "sample-store-suwon": "store_only"}
    suwon = client.get("/api/stores/sample-store-suwon").json()
    assert suwon["models_on_display"] == []  # store exists, but no model display evidence
    assert {m["id"] for m in suwon["linked_models"]} == {"sample-malang-pocket", "sample-pogeun-wood"}
    shown = client.get("/api/stores", params={"display_verified_only": True}).json()["items"]
    assert [s["id"] for s in shown] == ["sample-store-gangnam"]


def test_unknown_rights_image_is_not_displayed(client, research_dir: Path):
    path = research_dir / "models" / "sample-malang-hybrid.md"
    path.write_text(path.read_text(encoding="utf-8").replace(
        "specs:", "image:\n  image_url: https://example.com/img.jpg\n  rights_status: unknown\nspecs:", 1), encoding="utf-8")
    client.post("/api/admin/reload")
    img = client.get("/api/models/sample-malang-hybrid").json()["image"]
    assert img["display_url"] is None and img["placeholder_reason"] == "rights_unknown"


def test_compatibility_requires_source(client):
    detail = client.get("/api/models/sample-malang-pocket").json()
    assert [c["model_id"] for c in detail["compatibility"]] == ["sample-pogeun-wood"]


def test_compare_rules(client):
    ok = client.get("/api/compare", params={"ids": "sample-malang-pocket,sample-pogeun-wood"}).json()
    assert [m["id"] for m in ok["models"]] == ["sample-malang-pocket", "sample-pogeun-wood"]
    assert ok["price_options"] == ["K", "Q"]
    assert client.get("/api/compare", params={"ids": "sample-malang-pocket,sample-siwon-fridge"}).status_code == 400
    four = "sample-malang-pocket,sample-malang-hybrid,sample-pogeun-wood,sample-pogeun-storage"
    assert client.get("/api/compare", params={"ids": four}).status_code == 400


def test_research_report(client):
    rep = client.get("/api/research/beds").json()
    assert "침대 조사 개요" in rep["category"]["body_md"]
    assert {b["id"] for b in rep["brands"]} == {"sample-malang", "sample-pogeun"}
    assert client.get("/api/research/nope").status_code == 404


def test_personal_records_survive_reload_and_restart(client, make_client, research_dir: Path):
    client.put("/api/progress", json={"target_type": "model", "target_id": "sample-malang-pocket", "stage": "tried"})
    client.put("/api/progress", json={"target_type": "store", "target_id": "sample-store-gangnam", "visited": True})
    client.put("/api/personal-notes", json={
        "model_id": "sample-malang-pocket", "memo": "허리 편함", "rating": 4,
        "quotes": [{"amount_krw": 800000, "size_or_option": "Q", "quoted_on": "2026-10-20", "place": "샘플 쇼룸"}],
    })
    client.post("/api/admin/reload")

    restarted = make_client(research_dir)  # same SQLite file, fresh process state
    prog = restarted.get("/api/progress").json()
    [model] = prog["models"]
    assert model["stage"] == "tried"
    assert [s["reached"] for s in model["stamps"]] == [True, True, True, False, False]
    assert prog["stores"][0]["store_id"] == "sample-store-gangnam"
    note = restarted.get("/api/personal-notes", params={"model_id": "sample-malang-pocket"}).json()["items"][0]
    assert note["memo"] == "허리 편함" and note["quotes"][0]["amount_krw"] == 800000
    # Personal quotes never leak into researched prices.
    detail = restarted.get("/api/models/sample-malang-pocket").json()
    assert 800000 not in [r["amount_krw"] for g in detail["price_table"] for r in g["records"]]
    assert detail["my_stage"] == "tried"


def test_records_for_removed_model_are_kept_as_orphaned(client, research_dir: Path):
    client.put("/api/progress", json={"target_type": "model", "target_id": "sample-malang-hybrid", "stage": "wishlist"})
    (research_dir / "models" / "sample-malang-hybrid.md").unlink()
    client.post("/api/admin/reload")
    [row] = client.get("/api/progress").json()["models"]
    assert row["model_id"] == "sample-malang-hybrid" and row["orphaned"] is True


def test_progress_validation(client):
    assert client.put("/api/progress", json={"target_type": "model", "target_id": "nope", "stage": "tried"}).status_code == 404
    assert client.put("/api/progress", json={"target_type": "model", "target_id": "sample-malang-pocket", "stage": "bogus"}).status_code == 422
    assert client.put("/api/progress", json={"target_type": "store", "target_id": "sample-store-gangnam"}).status_code == 422
    client.put("/api/progress", json={"target_type": "model", "target_id": "sample-malang-pocket", "stage": "wishlist"})
    client.put("/api/progress", json={"target_type": "model", "target_id": "sample-malang-pocket", "stage": None})
    prog = client.get("/api/progress").json()
    assert prog["models"] == [] and prog["events"][0]["stage"] == "cleared"


def test_progress_filter_on_models(client):
    client.put("/api/progress", json={"target_type": "model", "target_id": "sample-pogeun-wood", "stage": "finalist"})
    got = client.get("/api/models", params={"progress": "finalist"}).json()["items"]
    assert [m["id"] for m in got] == ["sample-pogeun-wood"] and got[0]["my_stage"] == "finalist"
    assert "sample-pogeun-wood" not in {m["id"] for m in client.get("/api/models", params={"progress": "none"}).json()["items"]}


def test_v2_review_grades_and_buckets(client, research_dir: Path):
    base = """
schema_version: 1
entity_type: review
category_id: beds
brand_id: sample-malang
model_id: sample-malang-pocket
source_url: https://example.com/r
posted_at: 2026-01-01
purchase_evidence_level: actual_use_claim
sponsorship_status: unknown
review_sentiment: positive
updated_at: 2026-10-21
status: researching
"""
    write_md(research_dir, "reviews/g-d.md", base + "id: g-d\nreview_evidence_grade: D")
    write_md(research_dir, "reviews/g-e.md", base + "id: g-e\nreview_evidence_grade: E")
    write_md(research_dir, "reviews/g-x.md", base + "id: g-x\nreview_evidence_grade: X")
    write_md(research_dir, "reviews/snip.md", base + "id: snip\ncontent_access: snippet_only\nplatform: threads")
    write_md(research_dir, "reviews/dup1.md", base + "id: dup1\nreview_evidence_grade: B\nduplicate_group: same-author")
    write_md(research_dir, "reviews/dup2.md", base + "id: dup2\nreview_evidence_grade: B\nduplicate_group: same-author")
    assert client.post("/api/admin/reload").json()["summary"]["error"] == 0
    detail = client.get("/api/models/sample-malang-pocket").json()
    bucket = {r["id"]: r["bucket"] for r in detail["reviews"]}
    assert bucket["g-d"] == "purchase_reference"
    assert bucket["g-e"] == "community"
    assert bucket["g-x"] == "excluded"
    assert bucket["snip"] == "excluded"
    assert bucket["dup1"] == bucket["dup2"] == "experience"
    # 2 sample independents + one deduplicated pair
    assert detail["review_stats"]["independent"] == 3
