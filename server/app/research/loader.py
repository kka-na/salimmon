"""Reads research/*.md, validates each file against the contract and builds an in-memory index.

Nothing is dropped silently: every rejected file or broken reference becomes an Issue
with the file path, field and reason (the import validation report).
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from functools import cached_property
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import yaml
from pydantic import ValidationError

from .schema import (
    DIRECTORY_FOR_TYPE,
    ENTITY_CLASSES,
    Brand,
    Category,
    EntityBase,
    Model,
    Review,
    Store,
)

Severity = Literal["error", "warning", "info"]

FRONTMATTER_RE = re.compile(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)(.*)\Z", re.DOTALL)
IGNORED_NAMES = {"readme.md", "research_requests.md"}


@dataclass
class Issue:
    severity: Severity
    path: str
    field: str
    message: str
    entity_id: str | None = None

    def as_dict(self) -> dict:
        return {
            "severity": self.severity,
            "path": self.path,
            "field": self.field,
            "message": self.message,
            "entity_id": self.entity_id,
        }


@dataclass
class Entry:
    entity: EntityBase
    body: str
    path: str


@dataclass
class ResearchData:
    root: Path
    categories: dict[str, Entry] = field(default_factory=dict)
    brands: dict[str, Entry] = field(default_factory=dict)
    models: dict[str, Entry] = field(default_factory=dict)
    stores: dict[str, Entry] = field(default_factory=dict)
    reviews: dict[str, Entry] = field(default_factory=dict)
    issues: list[Issue] = field(default_factory=list)
    files_scanned: int = 0
    loaded_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def table(self, entity_type: str) -> dict[str, Entry]:
        return getattr(self, DIRECTORY_FOR_TYPE[entity_type])

    # Typed accessors keep call sites readable.
    def category(self, cid: str) -> Category | None:
        e = self.categories.get(cid)
        return e.entity if e else None  # type: ignore[return-value]

    def brand(self, bid: str | None) -> Brand | None:
        e = self.brands.get(bid or "")
        return e.entity if e else None  # type: ignore[return-value]

    def model(self, mid: str | None) -> Model | None:
        e = self.models.get(mid or "")
        return e.entity if e else None  # type: ignore[return-value]

    def store(self, sid: str | None) -> Store | None:
        e = self.stores.get(sid or "")
        return e.entity if e else None  # type: ignore[return-value]

    def review(self, rid: str | None) -> Review | None:
        e = self.reviews.get(rid or "")
        return e.entity if e else None  # type: ignore[return-value]

    @property
    def counts(self) -> dict[str, int]:
        return {t: len(self.table(t)) for t in DIRECTORY_FOR_TYPE}

    @cached_property
    def image_source_counts(self) -> Counter:
        """How many models cite each image_source_url (shared pages are not model-specific)."""
        return Counter(
            e.entity.image.image_source_url  # type: ignore[attr-defined]
            for e in self.models.values()
            if e.entity.image and e.entity.image.image_source_url  # type: ignore[attr-defined]
        )

    @property
    def has_sample_data(self) -> bool:
        return any(
            entry.entity.is_sample for t in DIRECTORY_FOR_TYPE for entry in self.table(t).values()
        )

    def report(self) -> dict:
        by_sev = {s: sum(1 for i in self.issues if i.severity == s) for s in ("error", "warning", "info")}
        return {
            "research_dir": str(self.root),
            "loaded_at": self.loaded_at.isoformat(),
            "files_scanned": self.files_scanned,
            "counts": self.counts,
            "summary": by_sev,
            "issues": [i.as_dict() for i in self.issues],
        }


def split_frontmatter(text: str) -> tuple[dict | None, str, str | None]:
    """Returns (frontmatter, body, error)."""
    text = text.lstrip("﻿")
    match = FRONTMATTER_RE.match(text)
    if not match:
        return None, text, "파일 맨 앞에 '---'로 감싼 YAML frontmatter가 없습니다"
    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError as exc:
        return None, match.group(2), f"YAML 파싱 오류: {exc}"
    if not isinstance(data, dict):
        return None, match.group(2), "frontmatter가 key: value 형태의 YAML 객체가 아닙니다"
    return data, match.group(2).strip("\n"), None


def _loc(err: dict) -> str:
    return ".".join(str(p) for p in err.get("loc", ())) or "(root)"


def load_research(root: Path) -> ResearchData:
    data = ResearchData(root=root)
    if not root.is_dir():
        data.issues.append(Issue("error", str(root), "(dir)", "조사 Markdown 디렉터리가 없습니다"))
        return data

    for path in sorted(root.rglob("*.md")):
        rel = path.relative_to(root).as_posix()
        if path.name.lower() in IGNORED_NAMES or any(p.startswith(("_", ".")) for p in path.relative_to(root).parts):
            continue
        data.files_scanned += 1
        _load_file(data, path, rel)

    _check_references(data)
    return data


def _load_file(data: ResearchData, path: Path, rel: str) -> None:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        data.issues.append(Issue("error", rel, "(file)", "UTF-8로 읽을 수 없습니다"))
        return

    front, body, err = split_frontmatter(text)
    if err or front is None:
        data.issues.append(Issue("error", rel, "frontmatter", err or "frontmatter 없음"))
        return

    raw_id = front.get("id") if isinstance(front.get("id"), str) else None
    etype = front.get("entity_type")
    cls = ENTITY_CLASSES.get(etype) if isinstance(etype, str) else None
    if cls is None:
        data.issues.append(
            Issue("error", rel, "entity_type", f"알 수 없는 entity_type: {etype!r} (category|brand|model|store|review)", raw_id)
        )
        return

    try:
        entity = cls.model_validate(front)
    except ValidationError as exc:
        for e in exc.errors():
            data.issues.append(Issue("error", rel, _loc(e), e["msg"], raw_id))
        return

    table = data.table(entity.entity_type)
    if entity.id in table:
        data.issues.append(
            Issue("error", rel, "id", f"중복 id: '{entity.id}'가 {table[entity.id].path}에 이미 있어 이 파일은 제외됨", entity.id)
        )
        return

    expected_dir = DIRECTORY_FOR_TYPE[entity.entity_type]
    parts = Path(rel).parts
    if len(parts) < 2 or parts[0] != expected_dir:
        data.issues.append(
            Issue("warning", rel, "entity_type", f"{entity.entity_type} 파일은 {expected_dir}/ 아래에 두는 것을 권장", entity.id)
        )
    if path.stem != entity.id:
        data.issues.append(Issue("info", rel, "id", f"파일명과 id가 다릅니다 (id='{entity.id}')", entity.id))
    extras = sorted((entity.model_extra or {}).keys())
    if extras:
        data.issues.append(
            Issue("info", rel, ",".join(extras), "규격에 없는 필드 — 값은 보존되지만 UI에는 쓰이지 않습니다", entity.id)
        )

    table[entity.id] = Entry(entity=entity, body=body, path=rel)


def _check_references(data: ResearchData) -> None:
    def warn(entry: Entry, fld: str, msg: str, severity: Severity = "warning") -> None:
        data.issues.append(Issue(severity, entry.path, fld, msg, entry.entity.id))

    # A model must belong to a known category, otherwise it cannot appear in any tab.
    for mid in list(data.models):
        entry = data.models[mid]
        m: Model = entry.entity  # type: ignore[assignment]
        if m.category_id not in data.categories:
            warn(entry, "category_id", f"카테고리 '{m.category_id}' 파일이 없어 이 모델은 도감에서 제외됨", "error")
            del data.models[mid]

    for entry in data.brands.values():
        for cid in entry.entity.category_ids:  # type: ignore[attr-defined]
            if cid not in data.categories:
                warn(entry, "category_ids", f"존재하지 않는 카테고리 '{cid}'")

    for entry in data.models.values():
        m = entry.entity  # type: ignore[assignment]
        if m.brand_id not in data.brands:
            warn(entry, "brand_id", f"브랜드 '{m.brand_id}' 파일이 없습니다 (브랜드 미확인으로 표시)")
        for sid in m.store_ids:
            if sid not in data.stores:
                warn(entry, "store_ids", f"존재하지 않는 매장 '{sid}'")
        for rid in m.review_ids:
            if rid not in data.reviews:
                warn(entry, "review_ids", f"존재하지 않는 후기 '{rid}'")
            elif (r := data.review(rid)) and r.model_id and r.model_id != m.id:
                warn(entry, "review_ids", f"후기 '{rid}'의 model_id는 '{r.model_id}'입니다")
        for comp in m.compatibility:
            if comp.model_id not in data.models:
                warn(entry, "compatibility", f"존재하지 않는 모델 '{comp.model_id}'")
            elif not comp.source_url:
                warn(entry, "compatibility", f"'{comp.model_id}' 호환 정보에 source_url이 없어 조합 추천에서 제외됨")
        if not m.prices:
            warn(entry, "prices", "가격 기록 없음 — '가격 미확인'으로 표시", "info")

    for entry in data.stores.values():
        s: Store = entry.entity  # type: ignore[assignment]
        for mid in s.model_ids_on_display:
            if mid not in data.models:
                warn(entry, "model_ids_on_display", f"존재하지 않는 모델 '{mid}'")
        if s.model_ids_on_display and s.display_status != "verified_on_display":
            warn(entry, "display_status", "model_ids_on_display가 있지만 display_status가 verified_on_display가 아니어서 전시 확인으로 표시하지 않음")
        if s.display_status == "verified_on_display" and not s.verified_at:
            warn(entry, "verified_at", "전시 확인 상태인데 verified_at이 없습니다")
        if s.display_status == "verified_on_display" and not s.model_ids_on_display:
            warn(entry, "model_ids_on_display", "전시 확인 상태지만 전시 모델 목록이 비어 있습니다")
        for bid in s.brand_ids:
            if bid not in data.brands:
                warn(entry, "brand_ids", f"존재하지 않는 브랜드 '{bid}'")
        if s.lat is None and not s.address:
            warn(entry, "address", "주소와 좌표가 모두 없어 지도에 표시할 수 없습니다", "info")

    for entry in data.reviews.values():
        r: Review = entry.entity  # type: ignore[assignment]
        if r.category_id not in data.categories:
            warn(entry, "category_id", f"존재하지 않는 카테고리 '{r.category_id}'")
        if r.model_id and r.model_id not in data.models:
            warn(entry, "model_id", f"존재하지 않는 모델 '{r.model_id}'")
        if r.brand_id and r.brand_id not in data.brands:
            warn(entry, "brand_id", f"존재하지 않는 브랜드 '{r.brand_id}'")
