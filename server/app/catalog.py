"""Turns validated research entities into API payloads.

All derived judgements (price freshness, which price is shown on a card, whether a
review counts as independent, whether a store really displays a model) are made
here so that the client only renders what it receives.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from .research.loader import ResearchData
from .research.schema import Claim, ImageInfo, Model, PriceRecord, Review, Source, Store

PRICE_KIND_PRIORITY = {"official_sale": 0, "official_list": 1, "user_reported_paid": 2, "historical_official": 3}

# Fallback labels for common spec keys. A category can override/extend them via spec_fields.
DEFAULT_SPEC_LABELS: dict[str, tuple[str, str | None]] = {
    "mattress_type": ("매트리스 타입", None),
    "firmness": ("경도", None),
    "thickness_mm": ("두께", "mm"),
    "dimensions_mm": ("규격", "mm"),
    "coil_type": ("코일 구조", None),
    "coil_count": ("코일 수", "개"),
    "foam_layers": ("폼 구성", None),
    "materials": ("소재", None),
    "frame_type": ("프레임 타입", None),
    "headboard": ("헤드보드", None),
    "height_mm": ("높이", "mm"),
    "storage": ("수납", None),
    "weight_kg": ("무게", "kg"),
    "capacity_l": ("용량", "L"),
    "energy_grade": ("에너지 효율 등급", None),
    "color": ("색상", None),
    "other": ("기타", None),
}


# Display labels for common enum-like spec values (UI wording, not product facts).
SPEC_VALUE_LABELS: dict[str, dict[str, str]] = {
    "mattress_type": {
        "pocket_spring": "포켓스프링",
        "bonnell_spring": "본넬스프링",
        "innerspring": "이너스프링",
        "hybrid": "하이브리드",
        "hybrid_z_spring": "하이브리드 (Z스프링)",
        "foam": "폼",
        "memory_foam": "메모리폼",
        "latex": "라텍스",
        "wood": "원목",
        "bed_set": "침대 세트",
    },
    "firmness": {
        "soft": "소프트",
        "premium_soft": "프리미엄 소프트",
        "plush": "플러시",
        "regular": "레귤러",
        "medium": "미디엄",
        "firm": "펌",
        "hard": "하드",
        "extra_firm": "엑스트라 펌",
        "super_firm": "슈퍼 펌",
        "ultra_firm_or_plush": "울트라 펌 또는 플러시",
    },
}
UNKNOWN_VALUES = {"unknown", "null", "none", "n/a"}


@dataclass
class Ctx:
    today: date
    stale_days: int
    links: dict[str, dict] = field(default_factory=dict)  # url -> {status, checked_at}


# ---------- primitives ----------

def link_info(ctx: Ctx, url: str | None) -> dict:
    if not url:
        return {"link_status": "none", "link_checked_at": None}
    hit = ctx.links.get(url)
    if not hit:
        return {"link_status": "unchecked", "link_checked_at": None}
    return {"link_status": hit["status"], "link_checked_at": hit["checked_at"]}


def source_view(ctx: Ctx, src: Source) -> dict:
    return {
        "url": src.url,
        "source_type": src.source_type,
        "title": src.title,
        "checked_at": src.checked_at,
        **link_info(ctx, src.url),
    }


def claim_view(ctx: Ctx, c: Claim) -> dict:
    return {
        "text": c.text,
        "source_url": c.source_url,
        "source_type": c.source_type,
        "checked_at": c.checked_at,
        **link_info(ctx, c.source_url),
    }


def image_view(img: ImageInfo | None, fallback_alt: str) -> dict:
    """display_url is only set when rights allow showing the image; otherwise the UI uses a placeholder."""
    if img is None or not img.image_url:
        return {"display_url": None, "image_source_url": img.image_source_url if img else None,
                "alt": (img.alt if img and img.alt else fallback_alt), "rights_status": img.rights_status if img else "unknown",
                "placeholder_reason": "no_image"}
    allowed = img.rights_status in ("permitted", "official_embed")
    return {
        "display_url": img.image_url if allowed else None,
        "image_source_url": img.image_source_url,
        "alt": img.alt or fallback_alt,
        "rights_status": img.rights_status,
        "placeholder_reason": None if allowed else "rights_unknown",
    }


def price_view(ctx: Ctx, p: PriceRecord) -> dict:
    age = (ctx.today - p.observed_at).days
    if p.price_kind == "historical_official":
        freshness = "historical"
    elif age > ctx.stale_days:
        freshness = "stale"
    else:
        freshness = "current"
    return {
        "amount_krw": p.amount_krw,
        "size_or_option": p.size_or_option,
        "price_kind": p.price_kind,
        "observed_at": p.observed_at,
        "source_url": p.source_url,
        "source_type": p.source_type,
        "note": p.note,
        "age_days": age,
        "freshness": freshness,
        **link_info(ctx, p.source_url),
    }


def representative_price(ctx: Ctx, m: Model) -> dict | None:
    """The single price shown on a card: newest current official price, then user-reported,
    then stale, then historical. The option/size always travels with it."""
    views = [price_view(ctx, p) for p in m.prices]
    if not views:
        return None

    def rank(v: dict) -> tuple:
        fresh = {"current": 0, "stale": 1, "historical": 2}[v["freshness"]]
        official = 0 if v["price_kind"] in ("official_sale", "official_list") else 1
        return (fresh, official, -v["observed_at"].toordinal(), PRICE_KIND_PRIORITY[v["price_kind"]])

    best = sorted(views, key=rank)[0]
    best["option_count"] = len({v["size_or_option"] for v in views})
    return best


def price_table(ctx: Ctx, m: Model) -> list[dict]:
    """Prices grouped by option — never merged across sizes."""
    groups: dict[str, list[dict]] = {}
    for p in m.prices:
        groups.setdefault(p.size_or_option, []).append(price_view(ctx, p))
    out = []
    for option, rows in groups.items():
        rows.sort(key=lambda v: v["observed_at"], reverse=True)
        out.append({"size_or_option": option, "records": rows})
    return out


def spec_rows(data: ResearchData, m: Model) -> list[dict]:
    cat = data.category(m.category_id)
    custom = {f.key: (f.label, f.unit) for f in (cat.spec_fields if cat else [])}
    rows = []
    for key, value in m.specs.items():
        if value in (None, "", [], {}):
            continue
        label, unit = custom.get(key) or DEFAULT_SPEC_LABELS.get(key) or (key.replace("_", " "), None)
        value_label = None
        if isinstance(value, str):
            if value.strip().lower() in UNKNOWN_VALUES:
                value_label = "미확인"
            elif re.fullmatch(r"level(\d+)", value):
                value_label = f"레벨 {value[5:]}"
            else:
                value_label = SPEC_VALUE_LABELS.get(key, {}).get(value)
        rows.append({"key": key, "label": label, "unit": unit, "value": json_safe(value), "value_label": value_label})
    return rows


# ---------- reviews ----------

def review_independence(r: Review) -> tuple[bool, list[str]]:
    """Independent = counts in the review statistics (contract v1 + v2 판정규칙 §4/§6)."""
    reasons = []
    if r.sponsorship_status == "sponsored_or_provided" or r.review_evidence_grade == "X":
        reasons.append("sponsored")
    if r.incentive_check == "disclosed":
        reasons.append("incentivized")
    if not r.source_url:
        reasons.append("no_source_url")
    if not r.posted_at:
        reasons.append("no_posted_at")
    if r.purchase_evidence_level == "unknown":
        reasons.append("no_use_or_purchase_claim")
    if r.content_access in ("snippet_only", "inaccessible"):
        reasons.append("source_not_read")
    if r.review_evidence_grade == "D":
        reasons.append("purchase_only_grade")
    if r.review_evidence_grade == "E":
        reasons.append("community_opinion")
    return (not reasons, reasons)


def review_bucket(r: Review) -> str:
    """Which list a review belongs to in the UI: experience | purchase_reference | community | excluded."""
    independent, reasons = review_independence(r)
    if independent:
        return "experience"
    hard = {"sponsored", "incentivized", "no_source_url", "no_posted_at", "source_not_read"}
    if not hard & set(reasons):
        if r.review_evidence_grade == "D":
            return "purchase_reference"
        if r.review_evidence_grade == "E":
            return "community"
    return "excluded"


def review_view(ctx: Ctx, data: ResearchData, r: Review, with_body: bool = True) -> dict:
    independent, reasons = review_independence(r)
    model = data.model(r.model_id)
    brand = data.brand(r.brand_id)
    out = {
        "id": r.id,
        "category_id": r.category_id,
        "brand_id": r.brand_id,
        "brand_name": brand.name if brand else None,
        "model_id": r.model_id,
        "model_name": model.name if model else None,
        "title": r.title,
        "source_name": r.source_name,
        "source_url": r.source_url,
        "posted_at": r.posted_at,
        "usage_duration": r.usage_duration,
        "purchase_evidence_level": r.purchase_evidence_level,
        "sponsorship_status": r.sponsorship_status,
        "review_sentiment": r.review_sentiment,
        "status": r.status,
        "updated_at": r.updated_at,
        "is_independent": independent,
        "exclusion_reasons": reasons,
        "bucket": review_bucket(r),
        "platform": r.platform,
        "content_access": r.content_access,
        "review_scope": r.review_scope,
        "review_evidence_grade": r.review_evidence_grade,
        "in_period": r.in_period,
        "incentive_check": r.incentive_check,
        "duplicate_group": r.duplicate_group,
        "is_sample": r.is_sample,
        **link_info(ctx, r.source_url),
    }
    if with_body:
        out["body_md"] = data.reviews[r.id].body
    return out


def reviews_for_model(data: ResearchData, m: Model) -> list[Review]:
    ids = list(dict.fromkeys(m.review_ids + [rid for rid, e in data.reviews.items() if e.entity.model_id == m.id]))  # type: ignore[attr-defined]
    return [r for rid in ids if (r := data.review(rid))]


def review_stats(reviews: list[Review]) -> dict:
    independent = [r for r in reviews if review_independence(r)[0]]
    # Posts by the same author across platforms (duplicate_group) count once.
    seen: set[str] = set()
    unique = []
    for r in independent:
        if r.duplicate_group:
            if r.duplicate_group in seen:
                continue
            seen.add(r.duplicate_group)
        unique.append(r)
    return {
        "total": len(reviews),
        "independent": len(unique),
        "excluded": len(reviews) - len(independent),
        "positive": sum(r.review_sentiment == "positive" for r in unique),
        "negative": sum(r.review_sentiment == "negative" for r in unique),
        "mixed": sum(r.review_sentiment == "mixed" for r in unique),
        "purchase_proof": sum(r.review_evidence_grade == "A" or r.purchase_evidence_level == "purchase_proof_shown" for r in unique),
    }


# ---------- stores ----------

def display_relation(s: Store, model_id: str) -> str | None:
    """display_verified only when the store lists the model AND its display status is verified."""
    if model_id in s.model_ids_on_display:
        return "display_verified" if s.display_status == "verified_on_display" else "display_unconfirmed"
    return None


def stores_for_model(data: ResearchData, m: Model) -> list[tuple[Store, str]]:
    out: list[tuple[Store, str]] = []
    for sid, entry in data.stores.items():
        s: Store = entry.entity  # type: ignore[assignment]
        rel = display_relation(s, m.id)
        if rel is None and sid in m.store_ids:
            rel = "store_only"
        if rel:
            out.append((s, rel))
    order = {"display_verified": 0, "display_unconfirmed": 1, "store_only": 2}
    out.sort(key=lambda t: (order[t[1]], t[0].name))
    return out


def store_view(ctx: Ctx, data: ResearchData, s: Store, with_body: bool = False) -> dict:
    verified_models = (
        [mid for mid in s.model_ids_on_display if mid in data.models]
        if s.display_status == "verified_on_display"
        else []
    )
    out = {
        "id": s.id,
        "name": s.name,
        "brand_ids": s.brand_ids,
        "brands": [{"id": b.id, "name": b.name} for bid in s.brand_ids if (b := data.brand(bid))],
        "category_ids": s.category_ids,
        "address": s.address,
        "lat": s.lat,
        "lng": s.lng,
        "has_verified_coords": s.lat is not None,
        "phone": s.phone,
        "hours": s.hours,
        "official_store_url": s.official_store_url,
        "map_url": s.map_url,
        "display_status": s.display_status,
        "verified_at": s.verified_at,
        "models_on_display": [
            {"id": mid, "name": data.models[mid].entity.name, "product_kind": data.models[mid].entity.product_kind}  # type: ignore[attr-defined]
            for mid in verified_models
        ],
        "status": s.status,
        "updated_at": s.updated_at,
        "is_sample": s.is_sample,
        "sources": [source_view(ctx, src) for src in s.sources],
    }
    if with_body:
        out["body_md"] = data.stores[s.id].body
        # Models that merely link to this store (no display evidence) are listed separately.
        out["linked_models"] = [
            {"id": mid, "name": e.entity.name}  # type: ignore[attr-defined]
            for mid, e in data.models.items()
            if s.id in e.entity.store_ids and mid not in verified_models  # type: ignore[attr-defined]
        ]
    return out


# ---------- models ----------

def model_summary(ctx: Ctx, data: ResearchData, m: Model) -> dict:
    brand = data.brand(m.brand_id)
    reviews = reviews_for_model(data, m)
    stores = stores_for_model(data, m)
    return {
        "id": m.id,
        "category_id": m.category_id,
        "brand_id": m.brand_id,
        "brand_name": brand.name if brand else None,
        "name": m.name,
        "model_code": m.model_code,
        "product_kind": m.product_kind,
        "status": m.status,
        "updated_at": m.updated_at,
        "last_verified_at": m.last_verified_at,
        "image": image_view(m.image, f"{brand.name if brand else ''} {m.name}".strip()),
        "representative_price": representative_price(ctx, m),
        "top_pro": m.pros[0].text if m.pros else None,
        "top_con": m.cons[0].text if m.cons else None,
        "review_stats": review_stats(reviews),
        "display_store_count": sum(1 for _, rel in stores if rel == "display_verified"),
        "store_count": len(stores),
        "is_sample": m.is_sample,
    }


def model_detail(ctx: Ctx, data: ResearchData, m: Model) -> dict:
    out = model_summary(ctx, data, m)
    brand = data.brand(m.brand_id)
    cat = data.category(m.category_id)
    gallery = [image_view(img, out["image"]["alt"]) for img in ([m.image] if m.image else []) + m.images]
    compat = []
    for c in m.compatibility:
        other = data.model(c.model_id)
        if other and c.source_url:
            compat.append({
                "model_id": other.id, "name": other.name, "product_kind": other.product_kind,
                "brand_name": (b.name if (b := data.brand(other.brand_id)) else None),
                "sizes": c.sizes, "source_url": c.source_url, "verified_at": c.verified_at, "note": c.note,
            })
    out.update({
        "category_name": cat.name if cat else None,
        "brand": {"id": brand.id, "name": brand.name, "name_en": brand.name_en, "official_url": brand.official_url} if brand else None,
        "gallery": gallery,
        "specs": spec_rows(data, m),
        "price_table": price_table(ctx, m),
        "pros": [claim_view(ctx, c) for c in m.pros],
        "cons": [claim_view(ctx, c) for c in m.cons],
        "warranty_summary": m.warranty_summary,
        "warranty_source_url": m.warranty_source_url,
        "warranty_link": link_info(ctx, m.warranty_source_url),
        "sources": [source_view(ctx, s) for s in m.source_urls],
        "reviews": [review_view(ctx, data, r) for r in reviews_for_model(data, m)],
        # Reviews about the brand in general (model_id null) — shown separately, never counted for this model.
        "brand_reviews": [
            review_view(ctx, data, e.entity)  # type: ignore[arg-type]
            for e in data.reviews.values()
            if e.entity.brand_id == m.brand_id and not e.entity.model_id and e.entity.id not in m.review_ids  # type: ignore[attr-defined]
        ],
        "stores": [
            {**store_view(ctx, data, s), "relation": rel} for s, rel in stores_for_model(data, m)
        ],
        "compatibility": compat,
        "body_md": data.models[m.id].body,
        "source_path": data.models[m.id].path,
    })
    return out


def price_value_for_filter(ctx: Ctx, m: Model) -> int | None:
    rep = representative_price(ctx, m)
    return rep["amount_krw"] if rep else None


def json_safe(value: Any) -> Any:
    """Specs are free-form YAML; make dates etc. serialisable."""
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, date):
        return value.isoformat()
    return value
