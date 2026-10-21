"""Pydantic models for Research Contract v1 (docs/조사MD_작성규격.md).

Fields documented in the contract keep their names and meaning. Extensions added
by the development side are optional and marked "extension" — see docs/DATA_SCHEMA.md.
Unknown frontmatter keys are preserved (extra="allow") and reported as info.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ID_PATTERN = r"^[a-z0-9][a-z0-9-]*$"

EntityType = Literal["category", "brand", "model", "store", "review"]
EntityStatus = Literal["verified", "partially_verified", "researching", "archived"]
# motion_bed is an extension: the contract checklist treats 모션베드 as its own product.
ProductKind = Literal["mattress", "bed_frame", "motion_bed", "appliance", "furniture", "etc"]
PriceKind = Literal["official_list", "official_sale", "user_reported_paid", "historical_official"]
RightsStatus = Literal["permitted", "official_embed", "unknown"]
DisplayStatus = Literal["verified_on_display", "store_only_verified", "unknown"]
PurchaseEvidence = Literal["actual_use_claim", "purchase_only", "purchase_proof_shown", "unknown"]
Sponsorship = Literal["confirmed_uncompensated", "sponsored_or_provided", "unknown"]
Sentiment = Literal["positive", "negative", "mixed"]
# v2 review fields (조사MD_작성규격.md "v2 추가", 후기_검색범위_판정규칙.md §6) — all optional.
ContentAccess = Literal["full", "snippet_only", "inaccessible"]
EvidenceGrade = Literal["A", "B", "C", "D", "E", "X"]
IncentiveCheck = Literal["no_disclosure_found", "disclosed", "unknown"]


def _check_url(value: str | None) -> str | None:
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    if not (value.startswith("https://") or value.startswith("http://")):
        raise ValueError("URL은 http:// 또는 https:// 로 시작해야 합니다")
    return value


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Source(BaseModel):
    """A cited source. Plain string URLs in the MD are accepted and normalised to this shape."""

    model_config = ConfigDict(extra="allow")

    url: str
    source_type: str = "unknown"  # official | independent_user | seller | media | unknown
    title: str | None = None
    checked_at: date | None = None

    v_url = field_validator("url")(lambda cls, v: _check_url(v))

    @model_validator(mode="before")
    @classmethod
    def _from_string(cls, data: Any) -> Any:
        return {"url": data} if isinstance(data, str) else data


class Claim(BaseModel):
    """A pro/con statement. Plain strings are accepted; source fields are optional."""

    model_config = ConfigDict(extra="allow")

    text: str = Field(min_length=1)
    source_url: str | None = None
    source_type: str | None = None
    checked_at: date | None = None

    v_url = field_validator("source_url")(lambda cls, v: _check_url(v))

    @model_validator(mode="before")
    @classmethod
    def _from_string(cls, data: Any) -> Any:
        return {"text": data} if isinstance(data, str) else data


class ImageInfo(_Strict):
    image_url: str | None = None
    image_source_url: str | None = None
    alt: str | None = None
    rights_status: RightsStatus = "unknown"

    @field_validator("image_url")
    @classmethod
    def _image_url(cls, v: str | None) -> str | None:
        if v is None or str(v).strip() == "":
            return None
        v = str(v).strip()
        if v.startswith("/assets/"):
            return v
        return _check_url(v)

    v_src = field_validator("image_source_url")(lambda cls, v: _check_url(v))


class PriceRecord(_Strict):
    amount_krw: int = Field(gt=0)
    size_or_option: str = Field(min_length=1)
    price_kind: PriceKind
    observed_at: date
    source_url: str
    source_type: str | None = None  # extension
    note: str | None = None  # extension

    @field_validator("amount_krw", mode="before")
    @classmethod
    def _int_only(cls, v: Any) -> Any:
        if isinstance(v, bool) or not isinstance(v, int):
            raise ValueError("amount_krw는 쉼표·단위 없는 정수여야 합니다 (예: 549000)")
        return v

    @field_validator("source_url")
    @classmethod
    def _source(cls, v: str) -> str:
        checked = _check_url(v)
        if checked is None:
            raise ValueError("가격에는 source_url이 필수입니다")
        return checked


class SpecField(_Strict):
    """Extension on category: display label/unit for a spec key."""

    key: str
    label: str
    unit: str | None = None


class Compatibility(_Strict):
    """Extension on model: confirmed compatibility with another model (e.g. mattress ↔ frame)."""

    model_id: str = Field(pattern=ID_PATTERN)
    sizes: list[str] = []
    source_url: str | None = None
    verified_at: date | None = None
    note: str | None = None

    v_url = field_validator("source_url")(lambda cls, v: _check_url(v))


class EntityBase(BaseModel):
    model_config = ConfigDict(extra="allow")

    schema_version: Literal[1]
    entity_type: EntityType
    id: str = Field(pattern=ID_PATTERN)
    updated_at: date
    status: EntityStatus
    is_sample: bool = False  # extension: test/demo data flag


class Category(EntityBase):
    entity_type: Literal["category"]
    name: str = Field(min_length=1)
    emoji: str | None = None
    sort_order: int = 100
    description: str | None = None  # extension
    spec_fields: list[SpecField] = []  # extension


class Brand(EntityBase):
    entity_type: Literal["brand"]
    category_ids: list[str] = []
    name: str = Field(min_length=1)
    name_en: str | None = None
    official_url: str | None = None
    source_urls: list[Source] = []  # extension

    v_url = field_validator("official_url")(lambda cls, v: _check_url(v))


class Model(EntityBase):
    entity_type: Literal["model"]
    category_id: str = Field(pattern=ID_PATTERN)
    brand_id: str = Field(pattern=ID_PATTERN)
    name: str = Field(min_length=1)
    product_kind: ProductKind
    model_code: str | None = None
    image: ImageInfo | None = None
    images: list[ImageInfo] = []  # extension: gallery
    specs: dict[str, Any] = {}
    prices: list[PriceRecord] = []
    pros: list[Claim] = []
    cons: list[Claim] = []
    warranty_summary: str | None = None
    warranty_source_url: str | None = None
    store_ids: list[str] = []
    review_ids: list[str] = []
    source_urls: list[Source] = []
    compatibility: list[Compatibility] = []  # extension
    last_verified_at: date | None = None  # extension

    v_url = field_validator("warranty_source_url")(lambda cls, v: _check_url(v))

    @field_validator("specs", mode="before")
    @classmethod
    def _specs_none(cls, v: Any) -> Any:
        return {} if v is None else v

    @field_validator(
        "prices", "pros", "cons", "store_ids", "review_ids", "source_urls", "images", "compatibility",
        mode="before",
    )
    @classmethod
    def _list_none(cls, v: Any) -> Any:
        return [] if v is None else v


class Store(EntityBase):
    entity_type: Literal["store"]
    name: str = Field(min_length=1)
    brand_ids: list[str] = []
    category_ids: list[str] = []
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    official_store_url: str | None = None
    map_url: str | None = None
    model_ids_on_display: list[str] = []
    display_status: DisplayStatus = "unknown"
    verified_at: date | None = None
    sources: list[Source] = []
    hours: str | None = None  # extension

    v_urls = field_validator("official_store_url", "map_url")(lambda cls, v: _check_url(v))

    @field_validator("brand_ids", "category_ids", "model_ids_on_display", "sources", mode="before")
    @classmethod
    def _list_none(cls, v: Any) -> Any:
        return [] if v is None else v

    @model_validator(mode="after")
    def _coords(self) -> "Store":
        if (self.lat is None) != (self.lng is None):
            raise ValueError("lat과 lng는 함께 입력하거나 함께 null이어야 합니다")
        if self.lat is not None and not (-90 <= self.lat <= 90 and -180 <= self.lng <= 180):  # type: ignore[operator]
            raise ValueError("좌표 범위가 올바르지 않습니다")
        return self


class Review(EntityBase):
    entity_type: Literal["review"]
    category_id: str = Field(pattern=ID_PATTERN)
    brand_id: str | None = None
    model_id: str | None = None
    source_url: str | None = None
    posted_at: date | None = None
    usage_duration: str | None = None
    purchase_evidence_level: PurchaseEvidence = "unknown"
    sponsorship_status: Sponsorship = "unknown"
    review_sentiment: Sentiment = "mixed"
    title: str | None = None  # extension
    source_name: str | None = None  # extension: e.g. 블로그/커뮤니티 이름
    # v2 optional fields
    platform: str | None = None
    content_access: ContentAccess | None = None
    review_scope: str | None = None
    review_evidence_grade: EvidenceGrade | None = None
    in_period: bool | None = None
    incentive_check: IncentiveCheck | None = None
    duplicate_group: str | None = None

    v_url = field_validator("source_url")(lambda cls, v: _check_url(v))


ENTITY_CLASSES: dict[str, type[EntityBase]] = {
    "category": Category,
    "brand": Brand,
    "model": Model,
    "store": Store,
    "review": Review,
}

DIRECTORY_FOR_TYPE = {
    "category": "categories",
    "brand": "brands",
    "model": "models",
    "store": "stores",
    "review": "reviews",
}
