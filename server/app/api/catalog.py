"""Read-only research endpoints. Data comes only from the loaded Markdown."""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import (
    DEFAULT_SPEC_LABELS,
    model_detail,
    model_summary,
    price_value_for_filter,
    review_stats,
    review_view,
    source_view,
    store_view,
)
from ..db import PROGRESS_STAGES, ModelProgress, StoreVisit
from ..research.loader import ResearchData
from ..research.schema import Brand, Category, Model, Review, Store
from ..state import AppState
from .deps import current_user_id, get_session, get_state

router = APIRouter(prefix="/api")


def _match(q: str | None, *fields: str | None) -> bool:
    if not q:
        return True
    needle = q.strip().lower()
    return any(needle in (f or "").lower() for f in fields)


def _stages(session: Session, user_id: str) -> dict[str, str]:
    rows = session.scalars(select(ModelProgress).where(ModelProgress.user_id == user_id)).all()
    return {r.model_id: r.stage for r in rows}


def _visited(session: Session, user_id: str) -> set[str]:
    rows = session.scalars(select(StoreVisit).where(StoreVisit.user_id == user_id)).all()
    return {r.store_id for r in rows}


def _models(data: ResearchData) -> list[Model]:
    return [e.entity for e in data.models.values()]  # type: ignore[misc]


@router.get("/health")
def health(state: AppState = Depends(get_state)) -> dict:
    rep = state.data.report()
    return {
        "status": "ok",
        "today": date.today(),
        "research": {
            "dir": rep["research_dir"],
            "loaded_at": rep["loaded_at"],
            "counts": rep["counts"],
            "issues": rep["summary"],
            "has_sample_data": state.data.has_sample_data,
        },
        "stale_price_days": state.settings.stale_price_days,
    }


@router.get("/validation-report")
def validation_report(state: AppState = Depends(get_state)) -> dict:
    return state.data.report()


@router.post("/admin/reload")
def admin_reload(state: AppState = Depends(get_state)) -> dict:
    if not state.settings.enable_admin:
        raise HTTPException(403, "ENABLE_ADMIN=false")
    return state.reload().report()


@router.get("/categories")
def categories(state: AppState = Depends(get_state)) -> list[dict]:
    data = state.data
    out = []
    for entry in data.categories.values():
        c: Category = entry.entity  # type: ignore[assignment]
        models = [m for m in _models(data) if m.category_id == c.id]
        out.append({
            "id": c.id,
            "name": c.name,
            "emoji": c.emoji,
            "sort_order": c.sort_order,
            "description": c.description,
            "status": c.status,
            "updated_at": c.updated_at,
            "is_sample": c.is_sample,
            "counts": {
                "models": len(models),
                "brands": sum(1 for e in data.brands.values() if c.id in e.entity.category_ids),  # type: ignore[attr-defined]
                "stores": sum(1 for e in data.stores.values() if c.id in e.entity.category_ids),  # type: ignore[attr-defined]
                "reviews": sum(1 for e in data.reviews.values() if e.entity.category_id == c.id),  # type: ignore[attr-defined]
            },
            "product_kinds": sorted({m.product_kind for m in models}),
        })
    out.sort(key=lambda c: (c["sort_order"], c["name"]))
    return out


def _brand_view(data: ResearchData, b: Brand) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "name_en": b.name_en,
        "official_url": b.official_url,
        "category_ids": b.category_ids,
        "status": b.status,
        "updated_at": b.updated_at,
        "is_sample": b.is_sample,
        "model_count": sum(1 for m in _models(data) if m.brand_id == b.id),
    }


@router.get("/brands")
def brands(
    category_id: str | None = None,
    q: str | None = None,
    state: AppState = Depends(get_state),
) -> list[dict]:
    data = state.data
    out = []
    for entry in data.brands.values():
        b: Brand = entry.entity  # type: ignore[assignment]
        has_models_in_cat = any(m.brand_id == b.id and m.category_id == category_id for m in _models(data))
        if category_id and category_id not in b.category_ids and not has_models_in_cat:
            continue
        if not _match(q, b.name, b.name_en, b.id):
            continue
        out.append(_brand_view(data, b))
    out.sort(key=lambda b: b["name"])
    return out


@router.get("/brands/{brand_id}")
def brand_detail(brand_id: str, state: AppState = Depends(get_state)) -> dict:
    data = state.data
    b = data.brand(brand_id)
    if not b:
        raise HTTPException(404, f"brand '{brand_id}' not found")
    ctx = state.ctx()
    return {
        **_brand_view(data, b),
        "sources": [source_view(ctx, s) for s in b.source_urls],
        "body_md": data.brands[brand_id].body,
        "models": [model_summary(ctx, data, m) for m in _models(data) if m.brand_id == b.id],
    }


@router.get("/models")
def models(
    category_id: str | None = None,
    brand_id: str | None = None,
    product_kind: str | None = None,
    q: str | None = None,
    price_min: int | None = Query(None, ge=0),
    price_max: int | None = Query(None, ge=0),
    progress: str | None = Query(None, description="any | none | a stage name"),
    sort: Literal["default", "price_asc", "price_desc", "updated"] = "default",
    state: AppState = Depends(get_state),
    session: Session = Depends(get_session),
    user_id: str = Depends(current_user_id),
) -> dict:
    data, ctx = state.data, state.ctx()
    stages = _stages(session, user_id)
    items = []
    for m in _models(data):
        if category_id and m.category_id != category_id:
            continue
        if brand_id and m.brand_id != brand_id:
            continue
        if product_kind and m.product_kind != product_kind:
            continue
        brand = data.brand(m.brand_id)
        if not _match(q, m.name, m.model_code, brand.name if brand else None, brand.name_en if brand else None):
            continue
        if price_min is not None or price_max is not None:
            price = price_value_for_filter(ctx, m)
            if price is None:
                continue
            if price_min is not None and price < price_min:
                continue
            if price_max is not None and price > price_max:
                continue
        stage = stages.get(m.id)
        if progress == "any" and not stage:
            continue
        if progress == "none" and stage:
            continue
        if progress in PROGRESS_STAGES and stage != progress:
            continue
        items.append({**model_summary(ctx, data, m), "my_stage": stage})

    def price_key(it: dict, missing: int) -> int:
        rp = it["representative_price"]
        return rp["amount_krw"] if rp else missing

    if sort == "price_asc":
        items.sort(key=lambda it: price_key(it, 1 << 62))
    elif sort == "price_desc":
        items.sort(key=lambda it: -price_key(it, -1))
    elif sort == "updated":
        items.sort(key=lambda it: it["updated_at"], reverse=True)
    else:
        items.sort(key=lambda it: (it["brand_name"] or "~", it["product_kind"], it["name"]))
    return {"total": len(items), "items": items}


@router.get("/models/{model_id}")
def model(
    model_id: str,
    state: AppState = Depends(get_state),
    session: Session = Depends(get_session),
    user_id: str = Depends(current_user_id),
) -> dict:
    m = state.data.model(model_id)
    if not m:
        raise HTTPException(404, f"model '{model_id}' not found")
    return {**model_detail(state.ctx(), state.data, m), "my_stage": _stages(session, user_id).get(m.id)}


@router.get("/compare")
def compare(
    ids: str = Query(..., description="comma separated model ids, max 3"),
    state: AppState = Depends(get_state),
    session: Session = Depends(get_session),
    user_id: str = Depends(current_user_id),
) -> dict:
    wanted = [i for i in dict.fromkeys(x.strip() for x in ids.split(",")) if i]
    if not 1 <= len(wanted) <= 3:
        raise HTTPException(400, "비교는 1~3개 모델만 가능합니다")
    data, ctx = state.data, state.ctx()
    found = [m for i in wanted if (m := data.model(i))]
    missing = [i for i in wanted if not data.model(i)]
    if len({m.category_id for m in found}) > 1:
        raise HTTPException(400, "같은 카테고리의 모델끼리만 비교할 수 있습니다")
    stages = _stages(session, user_id)
    details = [{**model_detail(ctx, data, m), "my_stage": stages.get(m.id)} for m in found]
    spec_keys: dict[str, dict] = {}
    for d in details:
        for row in d["specs"]:
            spec_keys.setdefault(row["key"], {"key": row["key"], "label": row["label"], "unit": row["unit"]})
    options = sorted({row["size_or_option"] for d in details for row in d["price_table"]})
    return {
        "category_id": found[0].category_id if found else None,
        "models": details,
        "missing_ids": missing,
        "spec_keys": list(spec_keys.values()),
        "price_options": options,
    }


@router.get("/stores")
def stores(
    category_id: str | None = None,
    brand_id: str | None = None,
    model_id: str | None = None,
    q: str | None = None,
    display_verified_only: bool = False,
    state: AppState = Depends(get_state),
    session: Session = Depends(get_session),
    user_id: str = Depends(current_user_id),
) -> dict:
    data, ctx = state.data, state.ctx()
    visited = _visited(session, user_id)
    items = []
    for entry in data.stores.values():
        s: Store = entry.entity  # type: ignore[assignment]
        if category_id and category_id not in s.category_ids:
            continue
        if brand_id and brand_id not in s.brand_ids:
            continue
        view = store_view(ctx, data, s)
        if model_id:
            m = data.model(model_id)
            on_display = any(x["id"] == model_id for x in view["models_on_display"])
            linked = bool(m and s.id in m.store_ids)
            if not (on_display or linked):
                continue
        if display_verified_only and not view["models_on_display"]:
            continue
        if not _match(q, s.name, s.address, *(b["name"] for b in view["brands"])):
            continue
        items.append({**view, "visited": s.id in visited})
    items.sort(key=lambda s: s["name"])
    return {"total": len(items), "items": items}


@router.get("/stores/{store_id}")
def store(
    store_id: str,
    state: AppState = Depends(get_state),
    session: Session = Depends(get_session),
    user_id: str = Depends(current_user_id),
) -> dict:
    s = state.data.store(store_id)
    if not s:
        raise HTTPException(404, f"store '{store_id}' not found")
    return {**store_view(state.ctx(), state.data, s, with_body=True), "visited": s.id in _visited(session, user_id)}


@router.get("/reviews")
def reviews(
    category_id: str | None = None,
    brand_id: str | None = None,
    model_id: str | None = None,
    include_excluded: bool = False,
    state: AppState = Depends(get_state),
) -> dict:
    data, ctx = state.data, state.ctx()
    selected: list[Review] = []
    model = data.model(model_id) if model_id else None
    for rid, entry in data.reviews.items():
        r: Review = entry.entity  # type: ignore[assignment]
        if category_id and r.category_id != category_id:
            continue
        if brand_id and r.brand_id != brand_id:
            continue
        if model_id and r.model_id != model_id and not (model and rid in model.review_ids):
            continue
        selected.append(r)
    views = [review_view(ctx, data, r) for r in selected]
    if not include_excluded:
        views = [v for v in views if v["is_independent"]]
    views.sort(key=lambda v: v["posted_at"] or date.min, reverse=True)
    return {"stats": review_stats(selected), "items": views}


@router.get("/research/{category_id}")
def research_report(category_id: str, state: AppState = Depends(get_state)) -> dict:
    data = state.data
    cat = data.category(category_id)
    if not cat:
        raise HTTPException(404, f"category '{category_id}' not found")
    brands = [e for e in data.brands.values() if category_id in e.entity.category_ids]  # type: ignore[attr-defined]
    models = [e for e in data.models.values() if e.entity.category_id == category_id]  # type: ignore[attr-defined]
    paths = {data.categories[category_id].path, *(e.path for e in brands), *(e.path for e in models)}
    return {
        "category": {
            "id": cat.id, "name": cat.name, "emoji": cat.emoji, "status": cat.status,
            "updated_at": cat.updated_at, "is_sample": cat.is_sample,
            "body_md": data.categories[category_id].body,
        },
        "brands": [
            {"id": e.entity.id, "name": e.entity.name, "status": e.entity.status,  # type: ignore[attr-defined]
             "updated_at": e.entity.updated_at, "body_md": e.body}
            for e in sorted(brands, key=lambda e: e.entity.name)  # type: ignore[attr-defined]
        ],
        "models": [
            {"id": e.entity.id, "name": e.entity.name, "brand_id": e.entity.brand_id,  # type: ignore[attr-defined]
             "product_kind": e.entity.product_kind, "status": e.entity.status}  # type: ignore[attr-defined]
            for e in models
        ],
        "issues": [i.as_dict() for i in data.issues if i.path in paths],
    }


@router.get("/spec-labels")
def spec_labels() -> dict:
    return {k: {"label": v[0], "unit": v[1]} for k, v in DEFAULT_SPEC_LABELS.items()}


@router.get("/reviews/{review_id}")
def review(review_id: str, state: AppState = Depends(get_state)) -> dict:
    r = state.data.review(review_id)
    if not r:
        raise HTTPException(404, f"review '{review_id}' not found")
    return review_view(state.ctx(), state.data, r)
